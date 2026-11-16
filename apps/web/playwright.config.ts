import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    // The internal ERP suite runs on the in-browser mock data and needs no API.
    { name: "chromium", testIgnore: [/screens\.spec\.ts/, /[\\/]buyer[\\/]/], use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "screens", testMatch: /screens\.spec\.ts/, timeout: 600_000, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    // The external Buyer Portal suite runs against the REAL API + database (`pnpm e2e:buyer`); the API must be running
    // against a disposable database (see apps/api/scripts/e2e-reset.ts).
    { name: "buyer", testMatch: /[\\/]buyer[\\/].*\.spec\.ts/, timeout: 120_000, use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, actionTimeout: 15_000, navigationTimeout: 30_000 } },
  ],
  webServer: {
    command: process.env.E2E_PROD ? `pnpm start` : `pnpm dev`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
