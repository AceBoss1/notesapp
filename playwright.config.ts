import { defineConfig, devices } from "@playwright/test";

// The smoke test (tests/smoke): a few minutes against a running site, to catch a broken page before members do.
//   Local or CI:  npm run build && npm run start, then  npm run test:smoke  (SMOKE_BASE_URL defaults to http://127.0.0.1:3000)
//   Staging:      SMOKE_BASE_URL=https://<the staging preview address> npm run test:smoke   (docs/STAGING.md)
export default defineConfig({
  testDir: "tests/smoke",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000", trace: "retain-on-failure" },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
