import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Portrait, mobile-first canvas game served from the repo root.
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
    passWithNoTests: true,
  },
});
