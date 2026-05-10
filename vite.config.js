import { defineConfig } from 'vite';

export default defineConfig({
  base: '/railrouter/',
  root: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 4567,
  },
  preview: {
    port: 4567,
  },
});
