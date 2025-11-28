import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { mongoOperationsService } from './mongo-operations.js';
import { clusterMonitorService } from './cluster-monitor.js';
import { atlasClient } from './atlas-client.js';
import { config } from './config.js';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  TestConfig,
  TestState,
  TestResults,
  OperationResult,
  ClusterStatus,
} from './types.js';

type ProfileName = 'resilient' | 'fragile' | 'custom';

/**
 * WebSocket Handler for real-time test communication
 */
export class SocketHandler {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents>;
  private testState: TestState = {
    status: 'IDLE',
    startTime: null,
    endTime: null,
    profiles: [],
    electionDuration: null,
    oldPrimary: null,
    newPrimary: null,
  };
  private testTimeout: NodeJS.Timeout | null = null;

  constructor(server: HttpServer) {
    this.io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(server, {
      cors: {
        origin: ['http://localhost:5173', 'http://localhost:3001'],
        methods: ['GET', 'POST'],
      },
    });

    this.setupEventHandlers();
  }

  /**
   * Set up Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
      console.log('Client connected:', socket.id);

      // Send current connection status
      socket.emit('connection:status', {
        connected: true,
        profiles: mongoOperationsService.getConnectedProfiles(),
      });

      // Handle test start request
      socket.on('test:start', (testConfig: TestConfig) => {
        this.startTest(testConfig);
      });

      // Handle test stop request
      socket.on('test:stop', () => {
        this.stopTest();
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  /**
   * Start a failover test
   */
  private async startTest(testConfig: TestConfig): Promise<void> {
    if (this.testState.status === 'RUNNING') {
      this.io.emit('test:error', { error: 'Test already running' });
      return;
    }

    console.log('Starting test with config:', testConfig);

    try {
      // Reset test state
      this.testState = {
        status: 'RUNNING',
        startTime: new Date(),
        endTime: null,
        profiles: testConfig.profiles,
        electionDuration: null,
        oldPrimary: null,
        newPrimary: null,
      };

      // Initialize MongoDB operations service
      await mongoOperationsService.initialize(
        testConfig.profiles as ProfileName[],
        (result: OperationResult) => {
          this.io.emit('operation:result', result);
        }
      );

      // Initialize cluster monitor
      await clusterMonitorService.initialize();
      clusterMonitorService.startMonitoring(config.test.clusterPollIntervalMs, {
        onStatusChange: (status: ClusterStatus) => {
          this.io.emit('cluster:status', status);
        },
        onFailoverDetected: (oldPrimary: string) => {
          this.testState.oldPrimary = oldPrimary;
          this.io.emit('failover:detected', {
            oldPrimary,
            timestamp: new Date(),
          });
        },
        onPrimaryChange: (oldPrimary: string, newPrimary: string, electionDuration: number) => {
          this.testState.oldPrimary = oldPrimary;
          this.testState.newPrimary = newPrimary;
          this.testState.electionDuration = electionDuration;
          this.io.emit('failover:complete', {
            oldPrimary,
            newPrimary,
            electionDuration,
            timestamp: new Date(),
          });
        },
      });

      // Emit test started event
      this.io.emit('test:started', {
        testId: mongoOperationsService.getTestId(),
        profiles: testConfig.profiles,
        timestamp: new Date(),
      });

      // Start continuous operations
      mongoOperationsService.startOperations(testConfig.operationIntervalMs);

      // Brief delay before triggering failover to establish baseline
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Trigger failover
      console.log('\n========================================');
      console.log('TRIGGERING FAILOVER VIA ATLAS API');
      console.log('Current primary:', clusterMonitorService.getCurrentPrimary());
      console.log('========================================\n');

      this.testState.oldPrimary = clusterMonitorService.getCurrentPrimary();
      clusterMonitorService.markFailoverTriggered();

      await atlasClient.triggerFailover();

      console.log('✓ Failover API call successful');
      console.log('  Waiting for Atlas to execute failover (typically 3-5 minutes)...\n');

      this.io.emit('failover:triggered', { timestamp: new Date() });

      // Set test timeout
      this.testTimeout = setTimeout(() => {
        this.completeTest();
      }, testConfig.durationSeconds * 1000);

    } catch (error) {
      console.error('Error starting test:', error);
      this.io.emit('test:error', {
        error: error instanceof Error ? error.message : String(error),
      });
      await this.cleanup();
    }
  }

  /**
   * Stop the current test
   */
  private async stopTest(): Promise<void> {
    if (this.testState.status !== 'RUNNING') {
      return;
    }

    this.testState.status = 'STOPPING';
    await this.completeTest();
  }

  /**
   * Complete the test and emit results
   */
  private async completeTest(): Promise<void> {
    if (this.testTimeout) {
      clearTimeout(this.testTimeout);
      this.testTimeout = null;
    }

    this.testState.endTime = new Date();
    this.testState.status = 'COMPLETE';

    // Gather metrics
    const allMetrics = mongoOperationsService.getAllMetrics();
    const metrics: TestResults['metrics'] = {};

    for (const profile of this.testState.profiles) {
      const profileMetrics = allMetrics.get(profile as ProfileName);
      if (profileMetrics) {
        metrics[profile as keyof typeof metrics] = profileMetrics;
      }
    }

    // Build results
    const results: TestResults = {
      testId: mongoOperationsService.getTestId(),
      startTime: this.testState.startTime!,
      endTime: this.testState.endTime,
      electionDuration: this.testState.electionDuration || 0,
      oldPrimary: this.testState.oldPrimary || 'unknown',
      newPrimary: this.testState.newPrimary || 'unknown',
      metrics,
    };

    // Emit completion event
    this.io.emit('test:complete', results);

    // Cleanup
    await this.cleanup();

    // Reset state to idle
    this.testState.status = 'IDLE';
  }

  /**
   * Cleanup resources
   */
  private async cleanup(): Promise<void> {
    await mongoOperationsService.cleanup();
    await clusterMonitorService.cleanup();
  }

  /**
   * Get current test state
   */
  getTestState(): TestState {
    return { ...this.testState };
  }
}

let socketHandler: SocketHandler | null = null;

export function initializeSocketHandler(server: HttpServer): SocketHandler {
  socketHandler = new SocketHandler(server);
  return socketHandler;
}

export function getSocketHandler(): SocketHandler | null {
  return socketHandler;
}
