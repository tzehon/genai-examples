import { MongoClient, Db, Collection } from 'mongodb';
import { config } from './config.js';
import { connectionProfiles, buildConnectionOptions, getCustomSettings } from './connection-profiles.js';
import type { OperationResult, ProfileMetrics } from './types.js';

type ProfileName = 'resilient' | 'fragile' | 'custom';

interface TestDocument {
  timestamp: Date;
  sequence: number;
  testId: string;
  profile: string;
}

/**
 * MongoDB Operations Service
 * Manages separate MongoClient instances for each profile and runs continuous operations
 */
export class MongoOperationsService {
  private clients: Map<ProfileName, MongoClient> = new Map();
  private dbs: Map<ProfileName, Db> = new Map();
  private collections: Map<ProfileName, Collection<TestDocument>> = new Map();

  private operationIntervals: Map<ProfileName, NodeJS.Timeout> = new Map();
  private sequences: Map<ProfileName, number> = new Map();
  private testId: string = '';
  private isRunning: boolean = false;

  private onOperationResult?: (result: OperationResult) => void;

  // Metrics tracking
  private metrics: Map<ProfileName, ProfileMetrics> = new Map();

  /**
   * Initialize MongoDB clients for specified profiles
   */
  async initialize(
    profiles: ProfileName[],
    onResult: (result: OperationResult) => void
  ): Promise<void> {
    this.onOperationResult = onResult;
    this.testId = `test-${Date.now()}`;

    for (const profile of profiles) {
      await this.initializeProfile(profile);
      this.sequences.set(profile, 0);
      this.metrics.set(profile, this.createEmptyMetrics());
    }
  }

  /**
   * Initialize a single profile's MongoDB client
   */
  private async initializeProfile(profile: ProfileName): Promise<void> {
    const profileConfig = connectionProfiles[profile];
    const settings = profile === 'custom' ? getCustomSettings() : profileConfig.settings;
    const options = buildConnectionOptions(settings);

    console.log(`\n========================================`);
    console.log(`[${profile.toUpperCase()}] Initializing MongoDB client`);
    console.log(`  Settings from profile:`, JSON.stringify(settings, null, 2));
    console.log(`  Built options:`, JSON.stringify(options, null, 2));
    console.log(`========================================\n`);

    const client = new MongoClient(config.mongodb.uri, options);
    await client.connect();

    const db = client.db(config.mongodb.database);
    const collection = db.collection<TestDocument>(config.mongodb.collection);

    this.clients.set(profile, client);
    this.dbs.set(profile, db);
    this.collections.set(profile, collection);
  }

  /**
   * Start continuous operations for all initialized profiles
   */
  startOperations(intervalMs: number): void {
    if (this.isRunning) return;
    this.isRunning = true;

    for (const [profile] of this.clients) {
      const interval = setInterval(() => {
        // Run write and read in parallel
        this.performWrite(profile);
        this.performRead(profile);
      }, intervalMs);

      this.operationIntervals.set(profile, interval);
    }
  }

  /**
   * Perform a write operation
   */
  private async performWrite(profile: ProfileName): Promise<void> {
    const collection = this.collections.get(profile);
    if (!collection) return;

    const sequence = (this.sequences.get(profile) || 0) + 1;
    this.sequences.set(profile, sequence);

    const startTime = Date.now();

    try {
      await collection.insertOne({
        timestamp: new Date(),
        sequence,
        testId: this.testId,
        profile,
      });

      const latency = Date.now() - startTime;
      this.recordSuccess(profile, 'write', latency);

      this.emitResult({
        profile,
        type: 'write',
        success: true,
        latency,
        timestamp: new Date(),
        sequence,
      });
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.recordFailure(profile, 'write', latency);

      this.emitResult({
        profile,
        type: 'write',
        success: false,
        latency,
        timestamp: new Date(),
        error: errorMessage,
        sequence,
      });
    }
  }

  /**
   * Perform a read operation
   */
  private async performRead(profile: ProfileName): Promise<void> {
    const collection = this.collections.get(profile);
    if (!collection) return;

    const startTime = Date.now();

    try {
      await collection.find({ testId: this.testId })
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray();

      const latency = Date.now() - startTime;
      this.recordSuccess(profile, 'read', latency);

      this.emitResult({
        profile,
        type: 'read',
        success: true,
        latency,
        timestamp: new Date(),
      });
    } catch (error) {
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.recordFailure(profile, 'read', latency);

      this.emitResult({
        profile,
        type: 'read',
        success: false,
        latency,
        timestamp: new Date(),
        error: errorMessage,
      });
    }
  }

  /**
   * Record successful operation in metrics
   */
  private recordSuccess(profile: ProfileName, type: 'write' | 'read', latency: number): void {
    const metrics = this.metrics.get(profile);
    if (!metrics) return;

    if (type === 'write') {
      metrics.totalWrites++;
      metrics.successfulWrites++;
      metrics.writeLatencies.push(latency);
      metrics.maxWriteLatency = Math.max(metrics.maxWriteLatency, latency);
    } else {
      metrics.totalReads++;
      metrics.successfulReads++;
      metrics.readLatencies.push(latency);
      metrics.maxReadLatency = Math.max(metrics.maxReadLatency, latency);
    }
  }

  /**
   * Record failed operation in metrics
   */
  private recordFailure(profile: ProfileName, type: 'write' | 'read', latency: number): void {
    const metrics = this.metrics.get(profile);
    if (!metrics) return;

    if (type === 'write') {
      metrics.totalWrites++;
      metrics.failedWrites++;
      metrics.writeLatencies.push(latency);
      metrics.maxWriteLatency = Math.max(metrics.maxWriteLatency, latency);
    } else {
      metrics.totalReads++;
      metrics.failedReads++;
      metrics.readLatencies.push(latency);
      metrics.maxReadLatency = Math.max(metrics.maxReadLatency, latency);
    }
  }

  /**
   * Emit operation result to callback
   */
  private emitResult(result: OperationResult): void {
    if (this.onOperationResult) {
      this.onOperationResult(result);
    }
  }

  /**
   * Create empty metrics object
   */
  private createEmptyMetrics(): ProfileMetrics {
    return {
      totalWrites: 0,
      successfulWrites: 0,
      failedWrites: 0,
      totalReads: 0,
      successfulReads: 0,
      failedReads: 0,
      maxWriteLatency: 0,
      maxReadLatency: 0,
      avgWriteLatency: 0,
      avgReadLatency: 0,
      writeLatencies: [],
      readLatencies: [],
    };
  }

  /**
   * Get metrics for a profile with computed averages
   */
  getMetrics(profile: ProfileName): ProfileMetrics | undefined {
    const metrics = this.metrics.get(profile);
    if (!metrics) return undefined;

    // Compute averages
    if (metrics.writeLatencies.length > 0) {
      metrics.avgWriteLatency = Math.round(
        metrics.writeLatencies.reduce((a, b) => a + b, 0) / metrics.writeLatencies.length
      );
    }
    if (metrics.readLatencies.length > 0) {
      metrics.avgReadLatency = Math.round(
        metrics.readLatencies.reduce((a, b) => a + b, 0) / metrics.readLatencies.length
      );
    }

    return { ...metrics };
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<ProfileName, ProfileMetrics> {
    const result = new Map<ProfileName, ProfileMetrics>();
    for (const [profile] of this.metrics) {
      const metrics = this.getMetrics(profile);
      if (metrics) {
        result.set(profile, metrics);
      }
    }
    return result;
  }

  /**
   * Get current test ID
   */
  getTestId(): string {
    return this.testId;
  }

  /**
   * Stop all operations
   */
  stopOperations(): void {
    this.isRunning = false;

    for (const [profile, interval] of this.operationIntervals) {
      clearInterval(interval);
      this.operationIntervals.delete(profile);
    }
  }

  /**
   * Cleanup all connections
   */
  async cleanup(): Promise<void> {
    this.stopOperations();

    for (const [profile, client] of this.clients) {
      try {
        await client.close();
      } catch (error) {
        console.error(`Error closing ${profile} client:`, error);
      }
    }

    this.clients.clear();
    this.dbs.clear();
    this.collections.clear();
    this.metrics.clear();
    this.sequences.clear();
  }

  /**
   * Check if operations are running
   */
  isOperationsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get connected profiles
   */
  getConnectedProfiles(): ProfileName[] {
    return Array.from(this.clients.keys());
  }
}

export const mongoOperationsService = new MongoOperationsService();
