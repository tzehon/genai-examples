import { MongoClient } from 'mongodb';
import { config } from './config.js';
import type { ClusterStatus, ClusterNode } from './types.js';

/**
 * Cluster Monitor Service
 * Monitors the MongoDB replica set topology and detects primary changes
 */
export class ClusterMonitorService {
  private client: MongoClient | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  private currentPrimary: string | null = null;
  private initialPrimary: string | null = null;  // Primary when failover was triggered
  private failoverRequestedTime: number | null = null;  // When API was called
  private lastSeenInitialPrimaryTime: number | null = null;  // Last time we saw the initial primary
  private failoverTriggered: boolean = false;
  private failoverComplete: boolean = false;

  private onStatusChange?: (status: ClusterStatus) => void;
  private onPrimaryChange?: (oldPrimary: string, newPrimary: string, electionDuration: number) => void;
  private onFailoverDetected?: (oldPrimary: string) => void;

  /**
   * Initialize the monitor with a new connection
   */
  async initialize(): Promise<void> {
    // Use a separate connection with longer timeout for monitoring
    this.client = new MongoClient(config.mongodb.uri, {
      serverSelectionTimeoutMS: 60000,
      directConnection: false,
    });

    await this.client.connect();

    // Get initial primary
    await this.updateClusterStatus();
  }

  /**
   * Start monitoring the cluster
   */
  startMonitoring(
    pollIntervalMs: number,
    callbacks: {
      onStatusChange?: (status: ClusterStatus) => void;
      onPrimaryChange?: (oldPrimary: string, newPrimary: string, electionDuration: number) => void;
      onFailoverDetected?: (oldPrimary: string) => void;
    }
  ): void {
    if (this.isMonitoring) return;

    this.onStatusChange = callbacks.onStatusChange;
    this.onPrimaryChange = callbacks.onPrimaryChange;
    this.onFailoverDetected = callbacks.onFailoverDetected;

    this.isMonitoring = true;
    this.failoverTriggered = false;
    this.failoverComplete = false;
    this.failoverRequestedTime = null;
    this.lastSeenInitialPrimaryTime = null;
    this.initialPrimary = null;

    this.pollInterval = setInterval(() => {
      this.updateClusterStatus();
    }, pollIntervalMs);
  }

  /**
   * Update cluster status and detect changes
   */
  private async updateClusterStatus(): Promise<void> {
    if (!this.client) return;

    try {
      const admin = this.client.db('admin');
      const result = await admin.command({ replSetGetStatus: 1 });

      const members = result.members || [];
      const nodes: ClusterNode[] = [];
      let primary: ClusterNode | null = null;
      const secondaries: ClusterNode[] = [];

      for (const member of members) {
        const node: ClusterNode = {
          id: member._id?.toString() || member.name,
          hostname: member.name?.split(':')[0] || 'unknown',
          port: parseInt(member.name?.split(':')[1] || '27017', 10),
          state: this.mapMemberState(member.stateStr),
          health: member.health || 0,
        };

        nodes.push(node);

        if (node.state === 'PRIMARY') {
          primary = node;
        } else if (node.state === 'SECONDARY') {
          secondaries.push(node);
        }
      }

      const status: ClusterStatus = {
        clusterName: config.atlas.clusterName,
        state: primary ? 'HEALTHY' : 'FAILOVER_IN_PROGRESS',
        primary,
        secondaries,
        lastUpdated: new Date(),
      };

      // Detect primary changes
      this.detectPrimaryChange(primary);

      // Emit status update
      if (this.onStatusChange) {
        this.onStatusChange(status);
      }
    } catch (error) {
      // During failover, we might not be able to get status
      console.log('Cluster status check failed (expected during failover):',
        error instanceof Error ? error.message : String(error)
      );

      // If failover was triggered and we can't get status, election is in progress
      if (this.failoverTriggered && this.initialPrimary) {
        const status: ClusterStatus = {
          clusterName: config.atlas.clusterName,
          state: 'FAILOVER_IN_PROGRESS',
          primary: null,
          secondaries: [],
          lastUpdated: new Date(),
        };

        if (this.onFailoverDetected) {
          this.onFailoverDetected(this.initialPrimary);
        }
        if (this.onStatusChange) {
          this.onStatusChange(status);
        }
      }
    }
  }

  /**
   * Detect and handle primary changes
   */
  private detectPrimaryChange(newPrimary: ClusterNode | null): void {
    const newPrimaryHost = newPrimary?.hostname || null;

    // If failover was triggered, watch for changes
    if (this.failoverTriggered && !this.failoverComplete && this.initialPrimary) {
      // Track when we last saw the initial primary (for accurate election timing)
      if (newPrimaryHost === this.initialPrimary) {
        this.lastSeenInitialPrimaryTime = Date.now();
      }

      // Check if primary has changed (different host OR no primary)
      const primaryChanged = newPrimaryHost !== this.initialPrimary;

      if (primaryChanged) {
        // Calculate election duration from when we LAST SAW the old primary
        const electionDuration = this.lastSeenInitialPrimaryTime
          ? (Date.now() - this.lastSeenInitialPrimaryTime) / 1000
          : 0;

        if (newPrimaryHost) {
          // NEW PRIMARY ELECTED!
          console.log(`\n========================================`);
          console.log(`🎉 FAILOVER COMPLETE!`);
          console.log(`  Old primary: ${this.initialPrimary}`);
          console.log(`  New primary: ${newPrimaryHost}`);
          console.log(`  Election duration: ${electionDuration.toFixed(1)}s`);
          console.log(`========================================\n`);

          this.failoverComplete = true;

          // Emit both events to ensure banners show
          if (this.onFailoverDetected) {
            this.onFailoverDetected(this.initialPrimary);
          }
          if (this.onPrimaryChange) {
            this.onPrimaryChange(this.initialPrimary, newPrimaryHost, electionDuration);
          }
        } else {
          // PRIMARY LOST - election in progress
          console.log(`\n========================================`);
          console.log(`⚠️  PRIMARY LOST!`);
          console.log(`  Old primary: ${this.initialPrimary}`);
          console.log(`  Election in progress...`);
          console.log(`========================================\n`);

          if (this.onFailoverDetected) {
            this.onFailoverDetected(this.initialPrimary);
          }
        }
      }
    }

    // Update current primary
    if (newPrimaryHost) {
      this.currentPrimary = newPrimaryHost;
    }
  }

  /**
   * Map MongoDB state string to our state type
   */
  private mapMemberState(stateStr: string): ClusterNode['state'] {
    switch (stateStr?.toUpperCase()) {
      case 'PRIMARY':
        return 'PRIMARY';
      case 'SECONDARY':
        return 'SECONDARY';
      case 'ARBITER':
        return 'ARBITER';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Get current primary hostname
   */
  getCurrentPrimary(): string | null {
    return this.currentPrimary;
  }

  /**
   * Mark that failover was triggered (called when API triggers failover)
   */
  markFailoverTriggered(): void {
    this.failoverTriggered = true;
    this.failoverComplete = false;
    this.failoverRequestedTime = Date.now();
    this.lastSeenInitialPrimaryTime = Date.now();  // Start timing from now
    this.initialPrimary = this.currentPrimary;

    console.log(`Failover triggered. Watching for primary change from: ${this.initialPrimary}`);
  }

  /**
   * Check if failover is in progress
   */
  isFailoverInProgress(): boolean {
    return this.failoverTriggered && !this.failoverComplete;
  }

  /**
   * Get time since failover was requested (for "waiting for Atlas" display)
   */
  getTimeSinceFailoverRequested(): number | null {
    if (!this.failoverRequestedTime) return null;
    return (Date.now() - this.failoverRequestedTime) / 1000;
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.stopMonitoring();

    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    this.currentPrimary = null;
    this.initialPrimary = null;
    this.failoverRequestedTime = null;
    this.lastSeenInitialPrimaryTime = null;
    this.failoverTriggered = false;
    this.failoverComplete = false;
  }
}

export const clusterMonitorService = new ClusterMonitorService();
