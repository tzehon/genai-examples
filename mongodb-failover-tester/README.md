# MongoDB Atlas Failover Tester

A full-stack application demonstrating that MongoDB driver defaults are already resilient - and showing what happens when you override them incorrectly.

## The Key Insight

**Modern MongoDB drivers are already configured for failover resilience. You don't need to do anything.**

| Setting | Default | Resilient? |
|---------|---------|------------|
| retryWrites | true (4.2+) | Yes |
| retryReads | true (6.0+) | Yes |
| serverSelectionTimeoutMS | 30000 (30s) | Yes |

**Failures happen when you explicitly override these defaults with bad values:**

```javascript
// This breaks failover resilience:
const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 2000,  // Too short for safety margin
  retryWrites: false,              // No automatic retries!
  retryReads: false,               // No automatic retries!
});
```

## How It Works (Architecture)

### Is This a Legitimate Test?

**Yes.** This test uses:
- **Separate MongoClient instances** with different configurations (not simulated)
- **Real Atlas failover** triggered via the official Admin API
- **Real read/write operations** against the actual database
- **Real latency and failure measurements**

### Test Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Node.js Server                          │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  MongoClient #1  │  │  MongoClient #2  │  │ MongoClient  │  │
│  │    (Resilient)   │  │    (Fragile)     │  │  #3 Monitor  │  │
│  │                  │  │                  │  │              │  │
│  │ • No config      │  │ • timeout: 2s    │  │ • Polls      │  │
│  │ • Uses defaults  │  │ • retries: false │  │   replSet    │  │
│  │ • 30s timeout    │  │                  │  │   Status     │  │
│  │ • retries: true  │  │                  │  │              │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │
│           │                     │                   │          │
│           └─────────────────────┴───────────────────┘          │
│                                 │                              │
└─────────────────────────────────┼──────────────────────────────┘
                                  │
                    ┌─────────────▼─────────────┐
                    │    MongoDB Atlas          │
                    │    Replica Set            │
                    │                           │
                    │  ┌─────┐ ┌─────┐ ┌─────┐  │
                    │  │ P   │ │ S   │ │ S   │  │
                    │  │     │ │     │ │     │  │
                    │  └─────┘ └─────┘ └─────┘  │
                    │                           │
                    └───────────────────────────┘
```

### Three Separate MongoClients

When you run a "Compare Both" test, the server creates **three completely independent MongoClient connections**:

| Client | Purpose | Configuration |
|--------|---------|---------------|
| **Resilient** | Run test operations | No overrides (driver defaults) |
| **Fragile** | Run test operations | 2s timeout, retries disabled |
| **Monitor** | Track cluster state | 60s timeout (never fails) |

Each client maintains its own connection pool, topology monitoring, and server selection logic.

### Test Flow

```
Timeline:
═══════════════════════════════════════════════════════════════════

0s      Start test
        ├── Create MongoClient #1 (resilient)
        ├── Create MongoClient #2 (fragile)
        └── Start continuous operations (every 150ms)

5s      Call Atlas API: POST /clusters/{name}/restartPrimaries
        └── Atlas begins orchestrating failover (3-5 min)

~180s   Atlas executes failover
        ├── Primary steps down
        ├── Election begins (typically under 10 seconds)
        │
        │   During election:
        │   ├── Resilient: Operations queue, wait up to 30s ✓
        │   └── Fragile: Operations fail after 2s ✗
        │
        └── New primary elected

~200s   Test continues until duration expires
        └── Final results calculated
```

### What Each Client Does

Both the resilient and fragile clients run the **exact same operations** in parallel:

```typescript
// Every 150ms, each client runs:

// 1. Write operation
await collection.insertOne({
  timestamp: new Date(),
  sequence: incrementingNumber,
  testId: 'test-1234567890',
  profile: 'resilient' | 'fragile'
});

// 2. Read operation
await collection.find({ testId: 'test-1234567890' })
  .sort({ timestamp: -1 })
  .limit(10)
  .toArray();
```

### Why Fragile Fails

During the brief election window:

| Scenario | What Happens |
|----------|--------------|
| **Resilient (30s timeout)** | Driver waits for new primary. 30s > election time. Success. |
| **Fragile (2s timeout)** | Driver gives up after 2s. 2s < election time. Fail. Retry? No, retries disabled. Fail again. |

### Cluster Monitor

A third MongoClient monitors the replica set topology by polling `replSetGetStatus`:

```typescript
// Every 2 seconds:
const result = await admin.command({ replSetGetStatus: 1 });
// Returns current primary, secondaries, and their states
```

This detects:
- When the primary hostname changes (failover complete)
- Election duration (time from failover trigger to new primary)

## Features

- Real-time cluster topology visualization
- Side-by-side comparison of resilient vs fragile configurations
- Live operation streaming during failover events
- Automatic primary failover triggering via Atlas Admin API
- Election duration measurement
- Clear explanation of why configurations succeed or fail

## Prerequisites

- Node.js 18+
- MongoDB Atlas M10+ cluster (shared clusters don't support failover API)
- Atlas API key with Project Owner permissions

## Setup

### 1. Install Dependencies

```bash
cd mongodb-failover-tester
npm install
```

### 2. Create Atlas API Key

1. Go to Atlas -> Organization Access -> API Keys -> Create
2. Set permissions: Project Owner
3. Add your IP to the API key access list
4. Save both the public and private keys

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
ATLAS_PUBLIC_KEY=your_public_key
ATLAS_PRIVATE_KEY=your_private_key
ATLAS_PROJECT_ID=your_project_id
ATLAS_CLUSTER_NAME=YourCluster
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/failover-test
```

### 4. Run the Application

```bash
npm run dev
```

Open http://localhost:5173

## Running a Test

1. Select **"Compare Both"** to run resilient and fragile side-by-side
2. Click **"Start Failover Test"**
3. Watch the comparison:
   - **Resilient (defaults)**: Operations continue with brief latency spike
   - **Fragile (bad overrides)**: Operations fail during election
4. See the results explaining exactly why

## The Comparison

| | Resilient | Fragile |
|---|-----------|---------|
| Code | `new MongoClient(uri)` | `new MongoClient(uri, { timeout: 2000, retries: false })` |
| serverSelectionTimeoutMS | 30000 (default) | 2000 (override) |
| retryWrites / retryReads | true (default) | false (override) |
| Election takes 8s | 30s > 8s, waits and succeeds | 2s < 8s, fails immediately, no retry |
| Result | **Zero failures** | **Many failures** |

## The Lesson

```javascript
// GOOD: Just use defaults
const client = new MongoClient(uri);

// BAD: Don't override with short timeouts and disabled retries
const client = new MongoClient(uri, {
  serverSelectionTimeoutMS: 2000,  // Too short for safety margin!
  retryWrites: false,              // Disables automatic retry!
  retryReads: false,               // Disables automatic retry!
});
```

## Why the 30-Second Default Timeout?

MongoDB elections are fast—typically completing in under 10 seconds. However, the default `serverSelectionTimeoutMS: 30000` (30s) provides a generous safety margin for:
- Network variability
- Cloud provider orchestration delays
- Edge cases in distributed systems

When a primary steps down:
1. Secondaries detect primary is gone (heartbeat timeout)
2. Eligible secondaries call an election
3. Voting occurs among replica set members
4. New primary is elected and ready to accept writes

If you override the timeout to 2 seconds, operations may fail because the driver gives up before confirming the new primary is ready—even though elections themselves are very fast.

> **Note:** When using Atlas's "Test Failover" feature, there's a 3-5 minute delay while Atlas orchestrates the test (planning, graceful shutdown, etc.). The election itself is still fast once it begins. The test duration setting accounts for this orchestration delay.

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Frontend**: React, TypeScript, Tailwind CSS
- **Real-time**: Socket.IO
- **Database**: MongoDB with official Node.js driver

## Project Structure

```
mongodb-failover-tester/
├── src/
│   ├── server/
│   │   ├── index.ts              # Express server entry point
│   │   ├── config.ts             # Environment configuration
│   │   ├── atlas-client.ts       # Atlas Admin API with digest auth
│   │   ├── connection-profiles.ts # Resilient/Fragile/Custom profiles
│   │   ├── mongo-operations.ts   # Continuous read/write operations
│   │   ├── cluster-monitor.ts    # Replica set topology monitoring
│   │   ├── socket-handler.ts     # WebSocket event handling
│   │   ├── routes.ts             # REST API endpoints
│   │   └── types.ts              # TypeScript types
│   ├── client/
│   │   ├── App.tsx               # Main React component
│   │   ├── index.tsx             # React entry point
│   │   ├── index.css             # Tailwind styles
│   │   ├── types.ts              # Frontend types
│   │   ├── components/           # React components
│   │   └── hooks/                # Custom React hooks
│   └── scripts/
│       └── cleanup.ts            # Database cleanup script
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── .env.example
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/cluster/status` | GET | Get cluster status from Atlas |
| `/api/profiles` | GET | Get all connection profiles |
| `/api/profiles/custom` | PUT | Update custom profile settings |
| `/api/test/status` | GET | Get current test status |

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `test:start` | Client -> Server | Start a failover test |
| `test:stop` | Client -> Server | Stop running test |
| `test:started` | Server -> Client | Test has begun |
| `test:complete` | Server -> Client | Test finished with results |
| `cluster:status` | Server -> Client | Cluster topology update |
| `operation:result` | Server -> Client | Read/write operation result |
| `failover:triggered` | Server -> Client | Failover API called |
| `failover:detected` | Server -> Client | Primary loss detected |
| `failover:complete` | Server -> Client | New primary elected |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "IP not whitelisted" | Add your IP to both Atlas Network Access AND API key access list |
| "Cluster not found" | Verify project ID and cluster name (case-sensitive) |
| "Failover not supported" | Use M10+ cluster (M0/M2/M5 don't support failover API) |
| "Connection timeout" | Check MongoDB URI and network connectivity |
| "Unauthorized" | Verify API keys and permissions (need Project Owner) |

## Cleanup

Remove test data from MongoDB:

```bash
npm run cleanup
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start both server and client in development mode |
| `npm run dev:server` | Start only the backend server |
| `npm run dev:client` | Start only the Vite dev server |
| `npm run build` | Build for production |
| `npm run start` | Run production build |
| `npm run cleanup` | Remove test data from database |

## License

MIT
