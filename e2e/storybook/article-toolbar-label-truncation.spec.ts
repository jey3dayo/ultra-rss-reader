import { expect, test } from "@playwright/test";
import {
  expectedGoogleFaviconHttp404UrlMatchers,
  expectNoRuntimeErrors,
  expectNoStorybookRuntimeErrorDom,
  installRuntimeErrorGuard,
} from "../helpers/runtime-error-guard";
import { getStorybookIframeUrl } from "./storybook-index-payload";

const mobileToolbarStoryId = "reader-article-articletoolbarview--mobile-default";
const mobileMinimumViewport = { width: 520, height: 220 };

test.describe("Storybook article toolbar labels", () => {
  test("mobile toolbar labels are not truncated at the minimum mobile width", async ({ page }) => {
    await page.setViewportSize(mobileMinimumViewport);
    const runtimeErrors = installRuntimeErrorGuard(page, {
      allowedHttp404UrlMatchers: expectedGoogleFaviconHttp404UrlMatchers,
    });

    try {
      await expect(async () => {
        runtimeErrors.clear();
        await page.goto(getStorybookIframeUrl(mobileToolbarStoryId), { waitUntil: "domcontentloaded", timeout: 15000 });
        await expect(page.locator("#storybook-root span.truncate").first()).toBeVisible({ timeout: 15000 });
      }).toPass({ timeout: 120000, intervals: [1000, 2000, 5000] });

      await expectNoStorybookRuntimeErrorDom(page);
      expectNoRuntimeErrors(page);
    } finally {
      runtimeErrors.dispose();
    }

    const labels = await page.locator("#storybook-root span.truncate").evaluateAll((elements) =>
      elements.map((element) => ({
        text: element.textContent,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      })),
    );

    expect(labels.map(({ text }) => text)).toEqual(["Read", "Star", "Preview"]);
    for (const { text, clientWidth, scrollWidth } of labels) {
      expect(scrollWidth, `${text} label is truncated`).toBeLessThanOrEqual(clientWidth);
    }
  });
});
