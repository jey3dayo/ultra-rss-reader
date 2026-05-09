import { expect, type Page, test } from "@playwright/test";
import { expectNoStorybookRuntimeErrorDom, installRuntimeErrorGuard } from "../helpers/runtime-error-guard";
import { getStorybookIndexStoryIds } from "./storybook-index-payload";

const uiReferenceCanvasUrls = [
  "/iframe.html?id=ui-reference-foundations-canvas--default",
  "/iframe.html?id=ui-reference-input-controls-canvas--default",
  "/iframe.html?id=ui-reference-button-controls-canvas--default",
  "/iframe.html?id=ui-reference-shell-overlay-canvas--default",
  "/iframe.html?id=ui-reference-settings-workspace-canvas--default",
  "/iframe.html?id=ui-reference-navigation-collections-canvas--default",
  "/iframe.html?id=ui-reference-view-specimens-canvas--default",
] as const;

const storybookIndexUrl = "/index.json";
const expectedUiReferenceStoryIds = uiReferenceCanvasUrls.map(getStorybookStoryIdFromIframeUrl);

function getStorybookStoryIdFromIframeUrl(url: string) {
  const storyId = new URL(url, "http://storybook.local").searchParams.get("id");

  if (!storyId) {
    throw new Error(`Storybook iframe URL is missing id: ${url}`);
  }

  return storyId;
}

function getMissingExpectedStoryIds(registryStoryIds: Iterable<string>) {
  const storyRegistry = new Set(registryStoryIds);
  return expectedUiReferenceStoryIds.filter((storyId) => !storyRegistry.has(storyId));
}

async function openUiReferenceCanvas(page: Page, url: string) {
  const runtimeErrors = installRuntimeErrorGuard(page);

  try {
    await expect(async () => {
      runtimeErrors.clear();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await expect(page.locator("#storybook-root")).not.toBeEmpty({ timeout: 15000 });
    }).toPass({ timeout: 120000, intervals: [1000, 2000, 5000] });

    await expectNoStorybookRuntimeErrorDom(page);
    expect(runtimeErrors.pageErrors).toEqual([]);
  } finally {
    runtimeErrors.dispose();
  }
}

test.describe("UI Reference canvas iframe smoke matrix", () => {
  test.beforeAll("verifies Storybook story registry before iframe smoke", async ({ request }) => {
    await expect(async () => {
      const response = await request.get(storybookIndexUrl, { timeout: 15000 });
      expect(response.ok()).toBe(true);

      const payload: unknown = await response.json();
      const registryStoryIds = getStorybookIndexStoryIds(payload);
      const missingStoryIds = getMissingExpectedStoryIds(registryStoryIds);

      expect(missingStoryIds).toEqual([]);
    }).toPass({ timeout: 120000, intervals: [1000, 2000, 5000] });
  });

  for (const url of uiReferenceCanvasUrls) {
    test(`loads ${url}`, async ({ page }) => {
      await openUiReferenceCanvas(page, url);
    });
  }
});
