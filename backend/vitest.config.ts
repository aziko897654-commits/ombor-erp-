import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // all e2e specs share one dev database; run files sequentially so
    // company-wide operations (e.g. payroll sweeping all active
    // employees) can't race across suites
    fileParallelism: false,
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2022',
      },
      module: { type: 'es6' },
    }),
  ],
});
