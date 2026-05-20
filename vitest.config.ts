import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'lib/**/__tests__/**/*.test.ts',
      'lib/**/*.test.ts',
      'components/**/__tests__/**/*.test.tsx',
      'components/**/__tests__/**/*.test.ts',
    ],
    environmentMatchGlobs: [
      ['components/**/__tests__/**/*.test.tsx', 'jsdom'],
      ['components/**/__tests__/**/*.test.ts', 'jsdom'],
    ],
    setupFiles: [],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
