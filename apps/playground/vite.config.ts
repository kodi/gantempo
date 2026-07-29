import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@gantempo/gantt': new URL('../../packages/gantt/src/index.tsx', import.meta.url).pathname,
    },
  },
});
