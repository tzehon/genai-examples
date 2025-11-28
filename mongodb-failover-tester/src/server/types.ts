// Connection Profile Types
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

// Cluster Types
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

// Operation Types
export interface OperationResult {
  profile: 'resilient' | 'fragile' | 'custom';
  type: 'write' | 'read';
  success: boolean;
  latency: number;
  timestamp: Date;
  error?: string;
  sequence?: number;
}

// Test Types
export interface TestConfig {
  profiles: ('resilient' | 'fragile' | 'custom')[];
  durationSeconds: number;
  operationIntervalMs: number;
}

export interface TestState {
  status: 'IDLE' | 'RUNNING' | 'STOPPING' | 'COMPLETE';
  startTime: Date | null;
  endTime: Date | null;
  profiles: ('resilient' | 'fragile' | 'custom')[];
  electionDuration: number | null;
  oldPrimary: string | null;
  newPrimary: string | null;
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
  writeLatencies: number[];
  readLatencies: number[];
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

// WebSocket Event Types
export interface ServerToClientEvents {
  'cluster:status': (status: ClusterStatus) => void;
  'operation:result': (result: OperationResult) => void;
  'failover:triggered': (data: { timestamp: Date }) => void;
  'failover:detected': (data: { oldPrimary: string; timestamp: Date }) => void;
  'failover:complete': (data: { oldPrimary: string; newPrimary: string; electionDuration: number; timestamp: Date }) => void;
  'test:started': (data: { testId: string; profiles: string[]; timestamp: Date }) => void;
  'test:complete': (results: TestResults) => void;
  'test:error': (data: { error: string }) => void;
  'connection:status': (data: { connected: boolean; profiles: string[] }) => void;
}

export interface ClientToServerEvents {
  'test:start': (config: TestConfig) => void;
  'test:stop': () => void;
}

// Atlas API Types
export interface AtlasClusterResponse {
  name: string;
  stateName: string;
  mongoDBVersion: string;
  connectionStrings: {
    standard: string;
    standardSrv: string;
  };
}

export interface AtlasProcessResponse {
  processes: Array<{
    id: string;
    hostname: string;
    port: number;
    typeName: string;
    userAlias: string;
  }>;
}
