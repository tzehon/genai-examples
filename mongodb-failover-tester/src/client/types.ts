// Shared types for frontend

export interface ConnectionProfile {
  name: 'resilient' | 'fragile' | 'custom';
  displayName: string;
  description: string;
  settings: ConnectionSettings;
  codeExample: string;
}

export interface ConnectionSettings {
  serverSelectionTimeoutMS?: number | null;
  socketTimeoutMS?: number | null;
  retryWrites?: boolean | null;
  retryReads?: boolean | null;
}

export interface ClusterNode {
  id: string;
  hostname: string;
  port: number;
  state: 'PRIMARY' | 'SECONDARY' | 'ARBITER' | 'UNKNOWN';
  health: number;
}

export interface ClusterStatus {
  clusterName: string;
  state: 'IDLE' | 'FAILOVER_IN_PROGRESS' | 'HEALTHY';
  primary: ClusterNode | null;
  secondaries: ClusterNode[];
  lastUpdated: Date;
}

export interface OperationResult {
  profile: 'resilient' | 'fragile' | 'custom';
  type: 'write' | 'read';
  success: boolean;
  latency: number;
  timestamp: Date;
  error?: string;
  sequence?: number;
}

export interface ProfileMetrics {
  totalWrites: number;
  successfulWrites: number;
  failedWrites: number;
  totalReads: number;
  successfulReads: number;
  failedReads: number;
  maxWriteLatency: number;
  maxReadLatency: number;
  avgWriteLatency: number;
  avgReadLatency: number;
}

export interface TestResults {
  testId: string;
  startTime: Date;
  endTime: Date;
  electionDuration: number;
  oldPrimary: string;
  newPrimary: string;
  metrics: {
    resilient?: ProfileMetrics;
    fragile?: ProfileMetrics;
    custom?: ProfileMetrics;
  };
}

export type TestStatus = 'IDLE' | 'RUNNING' | 'STOPPING' | 'COMPLETE';

export type ScenarioType = 'resilient' | 'fragile' | 'custom' | 'compare';

export interface TestConfig {
  profiles: ('resilient' | 'fragile' | 'custom')[];
  durationSeconds: number;
  operationIntervalMs: number;
}
