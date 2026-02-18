import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: "list",
  use: {
    // Base URL for the static file server started by webServer below.
    baseURL: "http://localhost:4200",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Serve the app directory as a static site during tests.
  webServer: {
    command: `node ${path.join(__dirname, "server.js")}`,
    url: "http://localhost:4200",
    reuseExistingServer: !process.env["CI"],
    timeout: 30_000,
  },
});
