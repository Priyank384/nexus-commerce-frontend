import { defineConfig, devices } from "@playwright/test";

// E2E runs against `next dev` on :3000 and expects the Spring backend on :3001
// (see ../NexusCommerce/.env — PORT=3001). Start both before `npm run test:e2e`.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  // One dev server, one Spring app, one login rate limiter: parallel workers only make the
  // suite flaky, they do not make it faster.
  workers: 1,
  // Cold `next dev` compiles each route on its first request, and that lands inside a spec's
  // own budget rather than in an assertion.
  timeout: 60_000,
  retries: process.env.CI ? 2 : 0,
  // A stray `test.only` left in a spec would silently skip the rest of the suite on CI.
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  globalSetup: "./e2e/warm-routes.ts",
  expect: {
    // A form submission here is a real server render, not a client route swap. The dev
    // backend talks to Aiven over the public internet where a cold render is five round
    // trips (~1.3s) and tails have been seen at 11s, so 10s is not enough headroom.
    timeout: 20_000,
  },
  use: {
    baseURL: "http://localhost:3000",
    navigationTimeout: 45_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
