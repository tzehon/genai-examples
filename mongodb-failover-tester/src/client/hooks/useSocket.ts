import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  ClusterStatus,
  OperationResult,
  TestResults,
  TestConfig,
} from '../types';

interface ClusterEvent {
  id: number;
  timestamp: Date;
  type: 'info' | 'warning' | 'success' | 'error';
  message: string;
}

interface SocketState {
  connected: boolean;
  clusterStatus: ClusterStatus | null;
  operations: OperationResult[];
  failedOperations: OperationResult[];  // Persisted failed ops (never trimmed)
  clusterEvents: ClusterEvent[];  // Real-time event stream
  testResults: TestResults | null;
  testRunning: boolean;
  failoverTriggered: boolean;
  failoverDetected: boolean;
  failoverComplete: boolean;
  electionTimer: number;
  oldPrimary: string | null;
  newPrimary: string | null;
  error: string | null;
}

interface UseSocketReturn extends SocketState {
  startTest: (config: TestConfig) => void;
  stopTest: () => void;
  clearOperations: () => void;
  clearResults: () => void;
}

const MAX_OPERATIONS = 200;
const MAX_EVENTS = 50;
let eventIdCounter = 0;

// Export ClusterEvent type for components
export type { ClusterEvent };

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const electionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const failoverStartRef = useRef<number | null>(null);
  const lastPrimaryRef = useRef<string | null>(null);

  const [state, setState] = useState<SocketState>({
    connected: false,
    clusterStatus: null,
    operations: [],
    failedOperations: [],
    clusterEvents: [],
    testResults: null,
    testRunning: false,
    failoverTriggered: false,
    failoverDetected: false,
    failoverComplete: false,
    electionTimer: 0,
    oldPrimary: null,
    newPrimary: null,
    error: null,
  });

  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setState(prev => ({ ...prev, connected: true, error: null }));
    });

    socket.on('disconnect', () => {
      setState(prev => ({ ...prev, connected: false }));
    });

    socket.on('cluster:status', (status: ClusterStatus) => {
      setState(prev => {
        const events = [...prev.clusterEvents];

        // Detect primary change via cluster status
        const newPrimaryHost = status.primary?.hostname || null;
        if (lastPrimaryRef.current && newPrimaryHost && newPrimaryHost !== lastPrimaryRef.current) {
          events.push({
            id: ++eventIdCounter,
            timestamp: new Date(),
            type: 'warning',
            message: `Primary changed: ${lastPrimaryRef.current.split('.')[0]} → ${newPrimaryHost.split('.')[0]}`,
          });
        }
        lastPrimaryRef.current = newPrimaryHost;

        return {
          ...prev,
          clusterStatus: status,
          clusterEvents: events.slice(-MAX_EVENTS),
        };
      });
    });

    socket.on('operation:result', (result: OperationResult) => {
      setState(prev => ({
        ...prev,
        operations: [...prev.operations.slice(-MAX_OPERATIONS + 1), result],
        // Store failed operations separately (never trimmed, max 100)
        failedOperations: result.success
          ? prev.failedOperations
          : [...prev.failedOperations.slice(-99), result],
      }));
    });

    socket.on('test:started', () => {
      lastPrimaryRef.current = null;
      setState(prev => ({
        ...prev,
        testRunning: true,
        testResults: null,
        operations: [],
        failedOperations: [],
        clusterEvents: [{
          id: ++eventIdCounter,
          timestamp: new Date(),
          type: 'info',
          message: 'Test started - initializing connections...',
        }],
        failoverTriggered: false,
        failoverDetected: false,
        failoverComplete: false,
        electionTimer: 0,
        oldPrimary: null,
        newPrimary: null,
        error: null,
      }));
    });

    socket.on('failover:triggered', () => {
      failoverStartRef.current = Date.now();
      setState(prev => ({
        ...prev,
        failoverTriggered: true,
        clusterEvents: [...prev.clusterEvents, {
          id: ++eventIdCounter,
          timestamp: new Date(),
          type: 'warning',
          message: 'Failover requested via Atlas API - waiting for Atlas to execute...',
        }].slice(-MAX_EVENTS),
      }));

      // Start election timer
      electionTimerRef.current = setInterval(() => {
        if (failoverStartRef.current) {
          const elapsed = (Date.now() - failoverStartRef.current) / 1000;
          setState(prev => ({ ...prev, electionTimer: elapsed }));
        }
      }, 100);
    });

    socket.on('failover:detected', (data: { oldPrimary: string }) => {
      setState(prev => ({
        ...prev,
        failoverDetected: true,
        oldPrimary: data.oldPrimary,
        clusterEvents: [...prev.clusterEvents, {
          id: ++eventIdCounter,
          timestamp: new Date(),
          type: 'error',
          message: `⚡ PRIMARY DOWN! Old primary: ${data.oldPrimary.split('.')[0]} - Election in progress...`,
        }].slice(-MAX_EVENTS),
      }));
    });

    socket.on('failover:complete', (data: { oldPrimary: string; newPrimary: string; electionDuration: number }) => {
      if (electionTimerRef.current) {
        clearInterval(electionTimerRef.current);
        electionTimerRef.current = null;
      }
      failoverStartRef.current = null;

      setState(prev => ({
        ...prev,
        failoverComplete: true,
        electionTimer: data.electionDuration,
        oldPrimary: prev.oldPrimary || data.oldPrimary,  // Use existing or from event
        newPrimary: data.newPrimary,
        clusterEvents: [...prev.clusterEvents, {
          id: ++eventIdCounter,
          timestamp: new Date(),
          type: 'success',
          message: `✓ ELECTION COMPLETE! ${data.oldPrimary.split('.')[0]} → ${data.newPrimary.split('.')[0]} (${data.electionDuration.toFixed(1)}s)`,
        }].slice(-MAX_EVENTS),
      }));
    });

    socket.on('test:complete', (results: TestResults) => {
      if (electionTimerRef.current) {
        clearInterval(electionTimerRef.current);
        electionTimerRef.current = null;
      }

      setState(prev => ({
        ...prev,
        testRunning: false,
        testResults: results,
        clusterEvents: [...prev.clusterEvents, {
          id: ++eventIdCounter,
          timestamp: new Date(),
          type: 'info',
          message: 'Test complete - results available',
        }].slice(-MAX_EVENTS),
      }));
    });

    socket.on('test:error', (data: { error: string }) => {
      if (electionTimerRef.current) {
        clearInterval(electionTimerRef.current);
        electionTimerRef.current = null;
      }

      setState(prev => ({
        ...prev,
        testRunning: false,
        error: data.error,
        clusterEvents: [...prev.clusterEvents, {
          id: ++eventIdCounter,
          timestamp: new Date(),
          type: 'error',
          message: `Error: ${data.error}`,
        }].slice(-MAX_EVENTS),
      }));
    });

    return () => {
      if (electionTimerRef.current) {
        clearInterval(electionTimerRef.current);
      }
      socket.disconnect();
    };
  }, []);

  const startTest = useCallback((config: TestConfig) => {
    if (socketRef.current) {
      socketRef.current.emit('test:start', config);
    }
  }, []);

  const stopTest = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('test:stop');
    }
  }, []);

  const clearOperations = useCallback(() => {
    setState(prev => ({ ...prev, operations: [] }));
  }, []);

  const clearResults = useCallback(() => {
    setState(prev => ({
      ...prev,
      testResults: null,
      failoverTriggered: false,
      failoverDetected: false,
      failoverComplete: false,
      electionTimer: 0,
      oldPrimary: null,
      newPrimary: null,
      failedOperations: [],
    }));
  }, []);

  return {
    ...state,
    startTest,
    stopTest,
    clearOperations,
    clearResults,
  };
}
