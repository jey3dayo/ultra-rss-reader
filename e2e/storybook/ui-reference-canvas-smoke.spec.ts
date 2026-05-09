import { expect, type Page, test } from "@playwright/test";
import {
  expectNoStorybookRuntimeErrorDom,
  installRuntimeErrorGuard,
} from "../helpers/runtime-error-guard";
import {
  getStorybookIframeStoryId,
  getStorybookIframeUrl,
  getStorybookIndexStoryIds,
  uiReferenceCanvasStoryIds,
} from "./storybook-index-payload";

const storybookIndexUrl = "/index.json";
const uiReferenceCanvasUrls = uiReferenceCanvasStoryIds.map(
  getStorybookIframeUrl,
);
const expectedUiReferenceStoryIdSet = new Set<string>(
  uiReferenceCanvasStoryIds,
);

function getMissingExpectedStoryIds(
  registryStoryIds: Iterable<string>,
): readonly string[] {
  const storyRegistry = new Set(registryStoryIds);
  return uiReferenceCanvasStoryIds.filter(
    (storyId) => !storyRegistry.has(storyId),
  );
}

function getUnknownUiReferenceIframeStoryIds(
  iframeUrls: readonly string[],
): string[] {
  return iframeUrls.flatMap((iframeUrl) => {
    const storyId = getStorybookIframeStoryId(iframeUrl);

    if (expectedUiReferenceStoryIdSet.has(storyId)) {
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
      await expect(page.locator("#storybook-root")).not.toBeEmpty({
        timeout: 15000,
      });
    }).toPass({ timeout: 120000, intervals: [1000, 2000, 5000] });

    await expectNoStorybookRuntimeErrorDom(page);
    expect(runtimeErrors.pageErrors).toEqual([]);
  } finally {
    runtimeErrors.dispose();
  }
}

test.describe("UI Reference canvas iframe smoke matrix", () => {
  test.beforeAll(
    "verifies Storybook story registry before iframe smoke",
    async ({ request }) => {
      await expect(async () => {
        const response = await request.get(storybookIndexUrl, {
          timeout: 15000,
        });
        expect(response.ok()).toBe(true);

        const payload: unknown = await response.json();
        const registryStoryIds = getStorybookIndexStoryIds(payload);
        const missingStoryIds = getMissingExpectedStoryIds(registryStoryIds);
        const unknownIframeStoryIds = getUnknownUiReferenceIframeStoryIds(
          uiReferenceCanvasUrls,
        );

        expect(missingStoryIds).toEqual([]);
        expect(unknownIframeStoryIds).toEqual([]);
      }).toPass({ timeout: 120000, intervals: [1000, 2000, 5000] });
    },
  );

  for (const url of uiReferenceCanvasUrls) {
    test(`loads ${url}`, async ({ page }) => {
      await openUiReferenceCanvas(page, url);
    });
  }
});
