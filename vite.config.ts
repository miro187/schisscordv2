import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000
  },
  resolve: {
    alias: {
      'process': 'process/browser',
      'buffer': 'buffer',
      'util': 'util'
    }
  },
  define: {
    'process.env': {},
    global: 'window'
  }
});
