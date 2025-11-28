import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist/client',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            // Suppress EPIPE/ECONNRESET errors during dev restarts
            if (err.message.includes('EPIPE') || err.message.includes('ECONNRESET')) {
              return;
            }
            console.error('Proxy error:', err.message);
          });
        },
      },
    },
  },
});
