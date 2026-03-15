import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider:  'v8',
      include:   ['src/**/*.js'],
      exclude:   ['src/app.js'],        // entry point — covered by e2e
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
      reporter:  ['text', 'html'],
    },
  },
});
