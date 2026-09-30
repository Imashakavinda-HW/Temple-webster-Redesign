import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development Vite serves the React app on :5173 and forwards API calls to Express
// on :3001, so the browser sees a single origin (cookies and CORS just work).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/mock-gateway': 'http://localhost:3001',
    },
  },
});
