# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
npm install
npm run dev          # Start both server + client (concurrent)
npm run dev:server   # Backend only (tsx watch)
npm run dev:client   # Frontend only (Vite)
npm run build        # Production build (client + server)
npm run start        # Run production build
npm run cleanup      # Remove test data from MongoDB
```

## Architecture

Full-stack TypeScript app demonstrating MongoDB driver failover resilience:
- **Backend**: Express + Socket.IO (`src/server/`)
- **Frontend**: React + Vite + Tailwind CSS (`src/client/`)
- **Real-time**: Socket.IO for operation streaming during failover tests

### Three MongoClient Strategy
The test creates three separate MongoClient instances:
1. **Resilient** - Uses driver defaults (30s timeout, retries enabled) - never fails
2. **Fragile** - Bad overrides (2s timeout, retries disabled) - fails during election
3. **Monitor** - 60s timeout, polls `replSetGetStatus` for topology changes

### Key Files
- `src/server/atlas-client.ts` - Atlas Admin API with HTTP Digest auth
- `src/server/connection-profiles.ts` - Resilient/Fragile/Custom profile definitions
- `src/server/mongo-operations.ts` - Continuous read/write operations
- `src/server/cluster-monitor.ts` - Replica set topology monitoring
- `src/server/socket-handler.ts` - WebSocket event handling

### Requirements
- MongoDB Atlas M10+ cluster (shared clusters don't support failover API)
- Atlas API key with Project Owner permissions
- Environment variables in `.env` (see `.env.example`)
