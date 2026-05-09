import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL: "http://localhost:1420",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  outputDir: "test-results/e2e",
  reporter: [["list"], ["html", { outputFolder: "playwright-report/e2e", open: "never" }]],
  webServer: {
    command: "pnpm dev:tauri:vite",
    url: "http://localhost:1420",
    reuseExistingServer: false,
    timeout: 10000,
  },
});
