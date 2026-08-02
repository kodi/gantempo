import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite-plus';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'simple-project-save-api',
      configurePreviewServer(server) {
        server.middlewares.use('/api/examples/simple-project.json', (request, response, next) => {
          if (request.method !== 'PUT') return next();
          response.statusCode = 204;
          response.end();
        });
      },
      configureServer(server) {
        server.middlewares.use('/api/examples/simple-project.json', (request, response, next) => {
          if (request.method !== 'PUT') return next();
          response.statusCode = 204;
          response.end();
        });
      },
    },
  ],
  resolve: {
    alias: [
      {
        find: /^@gantempo\/gantt\/react-query$/,
        replacement: new URL('../../packages/gantt/src/react-query.ts', import.meta.url).pathname,
      },
      {
        find: /^@gantempo\/gantt\/styles\.css$/,
        replacement: new URL('../../packages/gantt/src/styles.css', import.meta.url).pathname,
      },
      {
        find: /^@gantempo\/gantt$/,
        replacement: new URL('../../packages/gantt/src/index.tsx', import.meta.url).pathname,
      },
    ],
  },
});
