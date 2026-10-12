import { defineConfig } from 'vitest/config';

// Read workspace packages (such as @chronokid/shared) from their TypeScript source.
// The other entries are Vite's default server conditions.
const conditions = ['source', 'module', 'node', 'development|production'];

export default defineConfig({
  resolve: { conditions },
  ssr: { resolve: { conditions } },
  test: {
    include: ['test/**/*.test.ts'],
    globalSetup: ['test/global-setup.ts'],
    // Integration tests share one database, so run files one at a time.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000
  }
});
