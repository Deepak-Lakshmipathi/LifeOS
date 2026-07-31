import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  // Per-test timeout: 30 s is generous for offline/SW tests; default 30 000 ms
  timeout: 30_000,
  // Per-expect timeout: fast UI asserts should resolve quickly
  expect: { timeout: 8_000 },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    // Navigation + action timeouts
    navigationTimeout: 15_000,
    actionTimeout: 8_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Build is done separately in CI before this job step;
    // reuseExistingServer locally avoids a double-build when preview is already up.
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    // 60 s covered a clean build + vite preview start on an idle box, but this
    // budget spans the whole `build &&` above: with parallel agent worktrees
    // running suites, the build alone blows it and the run dies with
    // "Timed out waiting 60000ms from config.webServer" — infra noise that
    // reads as an app failure and got misreported as flake twice in wave 13.
    timeout: 180_000,
  },
})
