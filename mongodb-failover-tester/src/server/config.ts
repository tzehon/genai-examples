import dotenv from 'dotenv';

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config = {
  // Atlas Admin API
  atlas: {
    publicKey: requireEnv('ATLAS_PUBLIC_KEY'),
    privateKey: requireEnv('ATLAS_PRIVATE_KEY'),
    projectId: requireEnv('ATLAS_PROJECT_ID'),
    clusterName: requireEnv('ATLAS_CLUSTER_NAME'),
    baseUrl: 'https://cloud.mongodb.com/api/atlas/v2',
  },

  // MongoDB Connection
  mongodb: {
    uri: requireEnv('MONGODB_URI'),
    database: 'failover-test',
    collection: 'test-operations',
  },

  // Server
  server: {
    port: parseInt(optionalEnv('PORT', '3001'), 10),
  },

  // Test Settings
  test: {
    durationSeconds: parseInt(optionalEnv('TEST_DURATION_SECONDS', '90'), 10),
    operationIntervalMs: parseInt(optionalEnv('OPERATION_INTERVAL_MS', '150'), 10),
    clusterPollIntervalMs: 2000,
  },
};
