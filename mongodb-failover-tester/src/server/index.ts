import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config.js';
import { router } from './routes.js';
import { initializeSocketHandler } from './socket-handler.js';

const app = express();
const server = createServer(app);

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3001'],
  credentials: true,
}));
app.use(express.json());

// API routes
app.use('/api', router);

// Initialize WebSocket handler
initializeSocketHandler(server);

// Start server
server.listen(config.server.port, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         MongoDB Atlas Failover Tester Server               ║
╠════════════════════════════════════════════════════════════╣
║  Server running on port ${config.server.port}                             ║
║  Frontend: http://localhost:5173                           ║
║  API: http://localhost:${config.server.port}/api                          ║
╚════════════════════════════════════════════════════════════╝

Configuration:
  - Atlas Project: ${config.atlas.projectId}
  - Cluster: ${config.atlas.clusterName}
  - Test Duration: ${config.test.durationSeconds}s
  - Operation Interval: ${config.test.operationIntervalMs}ms
`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
