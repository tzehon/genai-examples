import { createHash } from 'crypto';
import { config } from './config.js';
import type { AtlasClusterResponse } from './types.js';

/**
 * Atlas Admin API client using HTTP Digest Authentication
 */
export class AtlasClient {
  private readonly baseUrl: string;
  private readonly publicKey: string;
  private readonly privateKey: string;
  private readonly projectId: string;
  private readonly clusterName: string;

  constructor() {
    this.baseUrl = config.atlas.baseUrl;
    this.publicKey = config.atlas.publicKey;
    this.privateKey = config.atlas.privateKey;
    this.projectId = config.atlas.projectId;
    this.clusterName = config.atlas.clusterName;
  }

  /**
   * Generate MD5 hash for digest auth
   */
  private md5(data: string): string {
    return createHash('md5').update(data).digest('hex');
  }

  /**
   * Parse WWW-Authenticate header for digest parameters
   */
  private parseDigestChallenge(header: string): Record<string, string> {
    const params: Record<string, string> = {};
    const regex = /(\w+)=(?:"([^"]+)"|([^\s,]+))/g;
    let match;
    while ((match = regex.exec(header)) !== null) {
      params[match[1]] = match[2] || match[3];
    }
    return params;
  }

  /**
   * Generate digest authorization header
   */
  private generateDigestAuth(
    method: string,
    uri: string,
    challenge: Record<string, string>
  ): string {
    const nc = '00000001';
    const cnonce = Math.random().toString(36).substring(2, 15);

    const ha1 = this.md5(`${this.publicKey}:${challenge.realm}:${this.privateKey}`);
    const ha2 = this.md5(`${method}:${uri}`);
    const response = this.md5(
      `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${challenge.qop}:${ha2}`
    );

    return `Digest username="${this.publicKey}", realm="${challenge.realm}", ` +
      `nonce="${challenge.nonce}", uri="${uri}", algorithm=MD5, ` +
      `response="${response}", qop=${challenge.qop}, nc=${nc}, cnonce="${cnonce}"`;
  }

  /**
   * Make an authenticated request to Atlas API
   */
  private async request<T>(
    method: string,
    path: string,
    body?: object
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    // First request to get the digest challenge
    const initialResponse = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.atlas.2023-11-15+json',
      },
    });

    if (initialResponse.status !== 401) {
      // No auth required or error
      if (!initialResponse.ok) {
        const error = await initialResponse.text();
        throw new Error(`Atlas API error: ${initialResponse.status} - ${error}`);
      }
      return initialResponse.json() as Promise<T>;
    }

    // Parse digest challenge
    const wwwAuth = initialResponse.headers.get('www-authenticate');
    if (!wwwAuth) {
      throw new Error('No WWW-Authenticate header received');
    }
    const challenge = this.parseDigestChallenge(wwwAuth);

    // Make authenticated request
    const uri = new URL(url).pathname;
    const authHeader = this.generateDigestAuth(method, uri, challenge);

    const authResponse = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.atlas.2023-11-15+json',
        'Authorization': authHeader,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!authResponse.ok) {
      const error = await authResponse.text();
      throw new Error(`Atlas API error: ${authResponse.status} - ${error}`);
    }

    // Handle empty responses (like POST to failover endpoint)
    const text = await authResponse.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  /**
   * Get cluster status
   */
  async getClusterStatus(): Promise<AtlasClusterResponse> {
    const path = `/groups/${this.projectId}/clusters/${this.clusterName}`;
    return this.request<AtlasClusterResponse>('GET', path);
  }

  /**
   * Trigger primary failover (restartPrimaries endpoint)
   */
  async triggerFailover(): Promise<void> {
    const path = `/groups/${this.projectId}/clusters/${this.clusterName}/restartPrimaries`;
    await this.request<void>('POST', path);
  }

  /**
   * Get cluster processes (replica set members)
   */
  async getClusterProcesses(): Promise<Array<{
    id: string;
    hostname: string;
    port: number;
    typeName: string;
  }>> {
    const path = `/groups/${this.projectId}/processes`;
    const response = await this.request<{
      results: Array<{
        id: string;
        hostname: string;
        port: number;
        typeName: string;
        userAlias: string;
      }>;
    }>('GET', path);

    // Filter to only include processes from our cluster
    return response.results.filter(p =>
      p.userAlias?.includes(this.clusterName) ||
      p.hostname?.includes(this.clusterName.toLowerCase())
    );
  }

  /**
   * Poll until cluster is healthy after failover
   */
  async pollClusterUntilHealthy(
    maxWaitMs: number = 120000,
    pollIntervalMs: number = 2000
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const status = await this.getClusterStatus();
        if (status.stateName === 'IDLE') {
          return;
        }
      } catch (error) {
        // Ignore errors during polling - cluster might be transitioning
      }
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error('Cluster did not become healthy within timeout');
  }
}

export const atlasClient = new AtlasClient();
