import { expect, type Page, test, type ViewportSize } from "@playwright/test";
import {
  expectNoRuntimeErrors,
  expectNoStorybookRuntimeErrorDom,
  installRuntimeErrorGuard,
} from "../helpers/runtime-error-guard";
import { getStorybookIframeUrl } from "./storybook-index-payload";

type DenseLayoutOverflowCase = {
  storyId: string;
  viewport: ViewportSize;
};

const denseLayoutOverflowCases = [
  {
    storyId: "reader-article-articletoolbarview--mobile-japanese-long-labels",
    viewport: { width: 390, height: 220 },
  },
  {
    storyId: "settings-shell-settingsmodalview--dense-narrow-viewport",
    viewport: { width: 390, height: 844 },
  },
  {
    storyId: "settings-account-accountdetailview--japanese-long-labels-dense",
    viewport: { width: 640, height: 720 },
  },
  {
    storyId: "subscriptions-list-subscriptionslistpane--reader-aligned",
    viewport: { width: 900, height: 720 },
  },
] satisfies readonly DenseLayoutOverflowCase[];

async function openStory(page: Page, storyId: string) {
  const runtimeErrors = installRuntimeErrorGuard(page);

  try {
    await expect(async () => {
      runtimeErrors.clear();
      await page.goto(getStorybookIframeUrl(storyId), { waitUntil: "domcontentloaded", timeout: 15000 });
      await expect(page.locator("#storybook-root > *, [role='dialog']").first()).toBeVisible({
        timeout: 15000,
      });
    }).toPass({ timeout: 120000, intervals: [1000, 2000, 5000] });

    await expectNoStorybookRuntimeErrorDom(page);
    expectNoRuntimeErrors(page);
  } finally {
    runtimeErrors.dispose();
  }
}

test.describe("Storybook dense UI layout overflow", () => {
  for (const { storyId, viewport } of denseLayoutOverflowCases) {
    test(`${storyId} does not create page-level horizontal overflow`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openStory(page, storyId);

      const overflow = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      }));

      expect(overflow).toEqual({
        clientWidth: viewport.width,
        scrollWidth: viewport.width,
        bodyScrollWidth: viewport.width,
      });
    });
  }
});
