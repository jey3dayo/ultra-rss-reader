import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e/storybook",
  testMatch: "accessibility.spec.ts",
  timeout: 60000,
  fullyParallel: true,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:6006",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  outputDir: "test-results/storybook-a11y",
  reporter: [["list"], ["html", { outputFolder: "playwright-report/storybook-a11y", open: "never" }]],
  webServer: {
    command: "pnpm exec vite preview --outDir storybook-static --host 127.0.0.1 --port 6006 --strictPort",
    url: "http://127.0.0.1:6006/index.json",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
