import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// Reuse the root .env (ignored by Git) so local runs find TEST_DATABASE_URL like the API tests do.
try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch {
  /* no .env: the full-stack tests are skipped */
}

const port = 5174;
const apiPort = 3101;
const baseURL = `http://localhost:${port}`;
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? '';
if (!testDatabaseUrl && process.env.REQUIRE_DB_TESTS === '1') {
  throw new Error('REQUIRE_DB_TESTS=1 but TEST_DATABASE_URL is not set.');
}

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Two workers matches GitHub's runners; the suite was stress-tested at this level.
  workers: process.env.CI ? 2 : undefined,
  // In CI: inline annotations, plus an HTML report the workflow uploads when tests fail.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // Tests start as returning visitors so the first-launch story does not cover the menus (intro.e2e.ts opts out).
    storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: [{ name: 'chronokid.introSeen', value: 'yes' }] }] }
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    // 375x667 portrait is where the prototype clipped its start button.
    { name: 'mobile-portrait', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 667 } } },
    { name: 'mobile-landscape', use: { ...devices['Pixel 7 landscape'] } }
  ],
  webServer: [
    {
      // Dev server: the browser tests use the development-only window.__chronokid hook.
      command: `npx vite --port ${port} --strictPort`,
      url: baseURL,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${apiPort}` },
      reuseExistingServer: !process.env.CI
    },
    // With a test database, run the real API (on its own port) so the game talks to it end to end.
    ...(testDatabaseUrl
      ? [{
          command: 'npx tsx --conditions=source src/server.ts',
          cwd: fileURLToPath(new URL('../api/', import.meta.url)),
          url: `http://127.0.0.1:${apiPort}/api/health/ready`,
          env: {
            DATABASE_URL: testDatabaseUrl,
            API_HOST: '127.0.0.1',
            API_PORT: String(apiPort),
            WEB_ORIGIN: baseURL,
            // Every test creates players from 127.0.0.1, far beyond the per-IP limits real clients get.
            RATE_LIMIT_SCALE: '100'
          },
          reuseExistingServer: !process.env.CI
        }]
      : [])
  ]
});
