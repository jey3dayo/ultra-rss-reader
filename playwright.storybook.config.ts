import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/storybook",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:6006",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm storybook",
    url: "http://127.0.0.1:6006",
    reuseExistingServer: true,
    timeout: 30000,
  },
});
