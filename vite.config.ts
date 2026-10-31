import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  base: '/projects/light-pos/',
  plugins: [tailwindcss(), react()] as any,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/projects/light-pos/api': {
        target: 'http://127.0.0.1:8787',
        rewrite: path => path.replace('/projects/light-pos', '')
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['server/*.node.test.mjs', 'node_modules/**', 'dist/**'],
    css: true
  }
});
