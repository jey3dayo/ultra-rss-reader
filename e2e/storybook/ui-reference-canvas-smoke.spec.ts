import { expect, type Page, test, type ViewportSize } from "@playwright/test";
import {
  expectNoRuntimeErrors,
  expectNoStorybookRuntimeErrorDom,
  installRuntimeErrorGuard,
} from "../helpers/runtime-error-guard";
import {
  denseNarrowViewportId,
  getStorybookIframeStoryId,
  getStorybookIframeUrl,
  getStorybookIndexStoryIds,
  storybookSmokeStoryIds,
  storybookViewportMaxDimensionPx,
} from "./storybook-index-payload";

const storybookIndexUrl = "/index.json";
const storybookSmokeUrls = storybookSmokeStoryIds.map(getStorybookIframeUrl);
const expectedStorybookSmokeStoryIdSet = new Set<string>(storybookSmokeStoryIds);
const storybookRenderedSurfaceSelector = "#storybook-root > *, [role='dialog']";
const denseNarrowSmokeViewport = {
  width: 390,
  height: 844,
} satisfies ViewportSize;

if (
  denseNarrowSmokeViewport.width > storybookViewportMaxDimensionPx ||
  denseNarrowSmokeViewport.height > storybookViewportMaxDimensionPx
) {
  throw new Error(`${denseNarrowViewportId} Storybook smoke viewport exceeds the dev window dimension cap`);
}

function getMissingExpectedStoryIds(registryStoryIds: Iterable<string>): readonly string[] {
  const storyRegistry = new Set(registryStoryIds);
  return storybookSmokeStoryIds.filter((storyId) => !storyRegistry.has(storyId));
}

function getUnknownStorybookSmokeIframeStoryIds(iframeUrls: readonly string[]): string[] {
  return iframeUrls.flatMap((iframeUrl) => {
    const storyId = getStorybookIframeStoryId(iframeUrl);

    if (expectedStorybookSmokeStoryIdSet.has(storyId)) {
      return [];
    }

    return [storyId];
  });
}

async function openUiReferenceCanvas(page: Page, url: string) {
  const runtimeErrors = installRuntimeErrorGuard(page);

  try {
    await expect(async () => {
      runtimeErrors.clear();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await expect(page.locator(storybookRenderedSurfaceSelector).first()).toBeVisible({
        timeout: 15000,
      });
    }).toPass({ timeout: 120000, intervals: [1000, 2000, 5000] });

    await expectNoStorybookRuntimeErrorDom(page);
    expectNoRuntimeErrors(page);
  } finally {
    runtimeErrors.dispose();
  }
}

test.describe("Storybook iframe smoke matrix", () => {
  test.use({ viewport: denseNarrowSmokeViewport });

  test.beforeAll("verifies Storybook story registry before iframe smoke", async ({ request }) => {
    await expect(async () => {
      const response = await request.get(storybookIndexUrl, {
        timeout: 15000,
      });
      expect(response.ok()).toBe(true);

      const payload: unknown = await response.json();
      const registryStoryIds = getStorybookIndexStoryIds(payload);
      const missingStoryIds = getMissingExpectedStoryIds(registryStoryIds);
      const unknownIframeStoryIds = getUnknownStorybookSmokeIframeStoryIds(storybookSmokeUrls);

      expect(missingStoryIds).toEqual([]);
      expect(unknownIframeStoryIds).toEqual([]);
    }).toPass({ timeout: 120000, intervals: [1000, 2000, 5000] });
  });

  for (const url of storybookSmokeUrls) {
    test(`loads ${url}`, async ({ page }) => {
      await openUiReferenceCanvas(page, url);
    });
  }
});
