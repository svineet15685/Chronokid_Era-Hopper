import { defineConfig, devices } from '@playwright/test';

const port = 5174;

export default defineConfig({
  testDir: './e2e',
  testMatch: '*.e2e.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // Two workers matches GitHub's runners; the suite was stress-tested at this level.
  workers: process.env.CI ? 2 : undefined,
  // In CI: inline annotations, plus an HTML report the workflow uploads when tests fail.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    // 375x667 portrait is where the prototype clipped its start button.
    { name: 'mobile-portrait', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 667 } } },
    { name: 'mobile-landscape', use: { ...devices['Pixel 7 landscape'] } }
  ],
  webServer: {
    // Dev server: the browser tests use the development-only window.__chronokid hook.
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI
  }
});
