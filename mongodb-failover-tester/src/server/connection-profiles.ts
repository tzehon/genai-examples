import type { ConnectionProfile, ConnectionSettings } from './types.js';

/**
 * Connection profiles demonstrating the difference between
 * using driver defaults (resilient) vs misconfiguring timeouts (fragile)
 */

export const connectionProfiles: Record<string, ConnectionProfile> = {
  resilient: {
    name: 'resilient',
    displayName: 'Resilient (Driver Defaults)',
    description: 'No special configuration - just use the driver defaults',
    settings: {
      // No overrides! Use driver defaults:
      // - serverSelectionTimeoutMS: 30000 (default)
      // - socketTimeoutMS: 0 (default, no timeout)
      // - retryWrites: true (default in 4.2+)
      // - retryReads: true (default in 6.0+)
    },
    codeExample: `// Resilient: Just use defaults
const client = new MongoClient(uri);
// That's it. No configuration needed.

// The driver defaults are already optimized:
// - retryWrites: true (automatic)
// - retryReads: true (automatic)
// - serverSelectionTimeoutMS: 30000 (30s)`
  },

  fragile: {
    name: 'fragile',
    displayName: 'Fragile (Bad Overrides)',
    description: 'Short timeouts + disabled retries - common misconfiguration',
    settings: {
      serverSelectionTimeoutMS: 2000,  // Overridden too low - elections take 10-30s!
      socketTimeoutMS: 2000,           // Overridden too low
      retryWrites: false,              // Disabled - no automatic retries
      retryReads: false,               // Disabled - no automatic retries
    },
    codeExample: `// Fragile: Explicitly misconfigured
const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 2000,  // Too short!
  socketTimeoutMS: 2000,           // Too short!
  retryWrites: false,              // No retries!
  retryReads: false,               // No retries!
});

// Elections typically take 10-30 seconds.
// With 2s timeout and no retries, operations WILL fail.`
  },

  custom: {
    name: 'custom',
    displayName: 'Custom Configuration',
    description: 'Experiment with different settings',
    settings: {
      serverSelectionTimeoutMS: null,  // null = use default
      socketTimeoutMS: null,
      retryWrites: null,               // null = use default (true)
      retryReads: null,                // null = use default (true)
    },
    codeExample: `// Custom: Your configuration
const client = new MongoClient(uri, {
  // Your custom settings here
});`
  }
};

// Mutable custom profile settings
let customSettings: ConnectionSettings = {
  serverSelectionTimeoutMS: null,
  socketTimeoutMS: null,
  retryWrites: null,
  retryReads: null,
};

/**
 * Get all profiles
 */
export function getProfiles(): ConnectionProfile[] {
  return Object.values(connectionProfiles).map(profile => {
    if (profile.name === 'custom') {
      return {
        ...profile,
        settings: { ...customSettings },
        codeExample: generateCustomCodeExample(customSettings),
      };
    }
    return profile;
  });
}

/**
 * Get a specific profile
 */
export function getProfile(name: string): ConnectionProfile | undefined {
  const profile = connectionProfiles[name];
  if (!profile) return undefined;

  if (name === 'custom') {
    return {
      ...profile,
      settings: { ...customSettings },
      codeExample: generateCustomCodeExample(customSettings),
    };
  }
  return profile;
}

/**
 * Update custom profile settings
 */
export function updateCustomProfile(settings: ConnectionSettings): void {
  customSettings = { ...settings };
}

/**
 * Get custom profile settings
 */
export function getCustomSettings(): ConnectionSettings {
  return { ...customSettings };
}

/**
 * Generate code example for custom settings
 */
function generateCustomCodeExample(settings: ConnectionSettings): string {
  const hasOverrides = Object.entries(settings).some(
    ([_, value]) => value !== null && value !== undefined
  );

  if (!hasOverrides) {
    return `// Custom: Using defaults (no overrides)
const client = new MongoClient(uri);
// Currently equivalent to resilient profile`;
  }

  const options: string[] = [];
  if (settings.serverSelectionTimeoutMS !== null && settings.serverSelectionTimeoutMS !== undefined) {
    const warning = settings.serverSelectionTimeoutMS < 30000 ? ' // Warning: < 30s' : '';
    options.push(`  serverSelectionTimeoutMS: ${settings.serverSelectionTimeoutMS},${warning}`);
  }
  if (settings.socketTimeoutMS !== null && settings.socketTimeoutMS !== undefined) {
    const warning = settings.socketTimeoutMS < 30000 ? ' // Warning: < 30s' : '';
    options.push(`  socketTimeoutMS: ${settings.socketTimeoutMS},${warning}`);
  }
  if (settings.retryWrites !== null && settings.retryWrites !== undefined) {
    const warning = settings.retryWrites === false ? ' // Warning: disabled!' : '';
    options.push(`  retryWrites: ${settings.retryWrites},${warning}`);
  }
  if (settings.retryReads !== null && settings.retryReads !== undefined) {
    const warning = settings.retryReads === false ? ' // Warning: disabled!' : '';
    options.push(`  retryReads: ${settings.retryReads},${warning}`);
  }

  return `// Custom: Your configuration
const client = new MongoClient(uri, {
${options.join('\n')}
});`;
}

/**
 * Build MongoDB connection options from settings
 */
export function buildConnectionOptions(settings: ConnectionSettings): Record<string, unknown> {
  const options: Record<string, unknown> = {};

  if (settings.serverSelectionTimeoutMS !== null && settings.serverSelectionTimeoutMS !== undefined) {
    options.serverSelectionTimeoutMS = settings.serverSelectionTimeoutMS;
  }
  if (settings.socketTimeoutMS !== null && settings.socketTimeoutMS !== undefined) {
    options.socketTimeoutMS = settings.socketTimeoutMS;
  }
  if (settings.retryWrites !== null && settings.retryWrites !== undefined) {
    options.retryWrites = settings.retryWrites;
  }
  if (settings.retryReads !== null && settings.retryReads !== undefined) {
    options.retryReads = settings.retryReads;
  }

  return options;
}
