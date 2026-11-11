import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// In dev, requests to /api are forwarded to the Express server,
// so the browser sees a single origin (no CORS or cookie problems).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
  test: {
    environment: 'jsdom', // a fake browser for React Testing Library
    globals: true, // lets Testing Library clean up after each test automatically
    setupFiles: './src/test/setup.js',
  },
});
