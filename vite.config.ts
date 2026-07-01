import { execSync } from 'node:child_process';
import { defineConfig } from 'vitest/config';

// Short commit SHA baked in at build time, so a screenshot of the running app tells you exactly
// which deploy you're looking at (Settings > Pages branch mix-ups, stale caches, etc).
function buildVersion(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'dev';
  }
}

export default defineConfig({
  // Portrait, mobile-first canvas game served from the repo root.
  base: './',
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion()),
  },
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
