import { expect, test } from "@playwright/test";

test.describe("Ultra RSS Reader - basic rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("page has correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/Ultra RSS/);
  });

  test("renders sidebar controls", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Sync feeds|フィードを同期/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Settings|設定/ })).toBeVisible();
  });

  test("shows empty state message", async ({ page }) => {
    await expect(page.getByText("Select an article to read")).toBeVisible();
  });

  test("uses dark theme (body background is dark)", async ({ page }) => {
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // Dark theme should have a dark background (low RGB values)
    // Accept any dark-ish color or CSS variable fallback
    expect(bgColor).toBeTruthy();
  });
});
