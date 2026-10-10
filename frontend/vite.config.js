import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const shared = fileURLToPath(new URL('../shared/y86', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@y86': shared },
  },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/api': `http://localhost:${process.env.API_PORT ?? 3001}`,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/@lezer') || id.includes('node_modules/codemirror')) return 'codemirror';
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
