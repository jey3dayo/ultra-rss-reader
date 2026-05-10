import { defineConfig } from "@playwright/test";

const isWindows = process.platform === "win32";
const storybookCommand = isWindows
  ? "pwsh -NoProfile -ExecutionPolicy Bypass -File node_modules/.bin/storybook.ps1 dev -p 6006 --no-open"
  : "pnpm storybook";
const storybookWebServerTimeoutMs = 120000;

export default defineConfig({
  testDir: "./e2e/storybook",
  timeout: 120000,
  forbidOnly: Boolean(process.env.CI),
  use: {
    baseURL: "http://127.0.0.1:6006",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  outputDir: "test-results/storybook",
  reporter: [["list"], ["html", { outputFolder: "playwright-report/storybook", open: "never" }]],
  webServer: {
    command: storybookCommand,
    url: "http://127.0.0.1:6006",
    reuseExistingServer: false,
    timeout: storybookWebServerTimeoutMs,
  },
});
