import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    pool: 'forks',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**'],
  },
  resolve: {
    alias: {
      // Mirror the "@/*" path alias from tsconfig so imports in tested files
      // resolve correctly when running under vitest.
      '@': path.resolve(__dirname, '.'),
    },
  },
});
