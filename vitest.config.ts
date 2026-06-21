import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: process.env.TEST_MODE === 'integration' ? ['tests/integration/**/*.test.ts'] : ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['node_modules/', 'dist/'],
    timeout: process.env.TEST_MODE === 'integration' ? 30000 : 10000,
    testTimeout: process.env.TEST_MODE === 'integration' ? 30000 : 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        '**/*.test.ts',
        '**/node_modules/**',
      ],
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
