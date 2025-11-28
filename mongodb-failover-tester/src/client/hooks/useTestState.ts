import { useState, useCallback } from 'react';
import type {
  ScenarioType,
  TestConfig,
  ConnectionSettings,
  OperationResult,
  ProfileMetrics,
} from '../types';

interface UseTestStateReturn {
  scenario: ScenarioType;
  setScenario: (scenario: ScenarioType) => void;
  testDuration: number;
  setTestDuration: (duration: number) => void;
  operationInterval: number;
  setOperationInterval: (interval: number) => void;
  customSettings: ConnectionSettings;
  setCustomSettings: (settings: ConnectionSettings) => void;
  getTestConfig: () => TestConfig;
  getProfilesToRun: () => ('resilient' | 'fragile' | 'custom')[];
  computeMetrics: (operations: OperationResult[], failedOperations: OperationResult[]) => Record<string, ProfileMetrics>;
}

const DEFAULT_CUSTOM_SETTINGS: ConnectionSettings = {
  serverSelectionTimeoutMS: null,
  socketTimeoutMS: null,
  retryWrites: null,
  retryReads: null,
};

export function useTestState(): UseTestStateReturn {
  const [scenario, setScenario] = useState<ScenarioType>('compare');
  const [testDuration, setTestDuration] = useState(360);
  const [operationInterval, setOperationInterval] = useState(150);
  const [customSettings, setCustomSettings] = useState<ConnectionSettings>(DEFAULT_CUSTOM_SETTINGS);

  const getProfilesToRun = useCallback((): ('resilient' | 'fragile' | 'custom')[] => {
    switch (scenario) {
      case 'resilient':
        return ['resilient'];
      case 'fragile':
        return ['fragile'];
      case 'custom':
        return ['custom'];
      case 'compare':
        return ['resilient', 'fragile'];
      default:
        return ['resilient'];
    }
  }, [scenario]);

  const getTestConfig = useCallback((): TestConfig => {
    return {
      profiles: getProfilesToRun(),
      durationSeconds: testDuration,
      operationIntervalMs: operationInterval,
    };
  }, [getProfilesToRun, testDuration, operationInterval]);

  const computeMetrics = useCallback((operations: OperationResult[], failedOperations: OperationResult[]): Record<string, ProfileMetrics> => {
    const metrics: Record<string, ProfileMetrics> = {};

    const profiles = ['resilient', 'fragile', 'custom'] as const;

    for (const profile of profiles) {
      // Use operations (sliding window) for successful ops
      const profileOps = operations.filter(op => op.profile === profile);

      // Use failedOperations (persisted) for failures - these never get trimmed
      const profileFailures = failedOperations.filter(op => op.profile === profile);
      const failedWrites = profileFailures.filter(op => op.type === 'write').length;
      const failedReads = profileFailures.filter(op => op.type === 'read').length;

      if (profileOps.length === 0 && profileFailures.length === 0) continue;

      const writes = profileOps.filter(op => op.type === 'write');
      const reads = profileOps.filter(op => op.type === 'read');

      const successfulWrites = writes.filter(op => op.success);
      const successfulReads = reads.filter(op => op.success);

      // Total counts include persisted failures (which may have been trimmed from operations)
      const totalWrites = successfulWrites.length + failedWrites;
      const totalReads = successfulReads.length + failedReads;

      metrics[profile] = {
        totalWrites,
        successfulWrites: successfulWrites.length,
        failedWrites,
        totalReads,
        successfulReads: successfulReads.length,
        failedReads,
        maxWriteLatency: writes.length > 0
          ? Math.max(...writes.map(op => op.latency))
          : 0,
        maxReadLatency: reads.length > 0
          ? Math.max(...reads.map(op => op.latency))
          : 0,
        avgWriteLatency: successfulWrites.length > 0
          ? Math.round(successfulWrites.reduce((sum, op) => sum + op.latency, 0) / successfulWrites.length)
          : 0,
        avgReadLatency: successfulReads.length > 0
          ? Math.round(successfulReads.reduce((sum, op) => sum + op.latency, 0) / successfulReads.length)
          : 0,
      };
    }

    return metrics;
  }, []);

  return {
    scenario,
    setScenario,
    testDuration,
    setTestDuration,
    operationInterval,
    setOperationInterval,
    customSettings,
    setCustomSettings,
    getTestConfig,
    getProfilesToRun,
    computeMetrics,
  };
}
