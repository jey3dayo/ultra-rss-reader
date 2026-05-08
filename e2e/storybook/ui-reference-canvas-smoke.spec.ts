import { expect, type Page, test } from "@playwright/test";

const uiReferenceCanvasUrls = [
  "/iframe.html?id=ui-reference-foundations-canvas--default",
  "/iframe.html?id=ui-reference-input-controls-canvas--default",
  "/iframe.html?id=ui-reference-button-controls-canvas--default",
  "/iframe.html?id=ui-reference-shell-overlay-canvas--default",
  "/iframe.html?id=ui-reference-settings-workspace-canvas--default",
  "/iframe.html?id=ui-reference-navigation-collections-canvas--default",
  "/iframe.html?id=ui-reference-view-specimens-canvas--default",
] as const;

async function openUiReferenceCanvas(page: Page, url: string) {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await expect(async () => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await expect(page.locator("#storybook-root")).not.toBeEmpty({ timeout: 15000 });
  }).toPass({ timeout: 120000, intervals: [1000, 2000, 5000] });

  await expect(
    page.locator("text=/StorybookError|Cannot find module|Failed to fetch dynamically imported module/i"),
  ).toHaveCount(0);
  expect(pageErrors).toEqual([]);
}

test.describe("UI Reference canvas iframe smoke matrix", () => {
  for (const url of uiReferenceCanvasUrls) {
    test(`loads ${url}`, async ({ page }) => {
      await openUiReferenceCanvas(page, url);
    });
  }
});
