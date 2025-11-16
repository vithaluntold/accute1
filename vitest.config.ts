import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./server/__tests__/setup.ts'],
    include: ['server/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'build'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Run tests serially for database safety
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@': path.resolve(__dirname, './client/src'),
      '@db': path.resolve(__dirname, './server/db.ts'),
    },
  },
});
