import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/frontend",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  outputDir: "test-results",
  use: {
    baseURL: "http://127.0.0.1:3101",
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
    trace: "retain-on-failure",
    ...(process.env.PLAYWRIGHT_CHROME_CHANNEL
      ? { channel: process.env.PLAYWRIGHT_CHROME_CHANNEL }
      : {}),
  },
  webServer: {
    command: "node scripts/start-frontend-tests.mjs",
    url: "http://127.0.0.1:3101/chat",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
