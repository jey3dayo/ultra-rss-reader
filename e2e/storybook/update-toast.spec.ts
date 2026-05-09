import { expect, type Page, test } from "@playwright/test";
import { expectNoStorybookRuntimeErrorDom, installRuntimeErrorGuard } from "../helpers/runtime-error-guard";

const updateToastTestIds = [
  "reference-update-toast-download-0",
  "reference-update-toast-download-90",
  "reference-update-toast-ready",
] as const;

const shellOverlayStoryUrl = "/iframe.html?id=ui-reference-shell-overlay-canvas--default";

async function openShellOverlayStory(page: Page) {
  const runtimeErrors = installRuntimeErrorGuard(page);

  try {
    await expect(async () => {
      runtimeErrors.clear();
      await page.goto(shellOverlayStoryUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      await expect(page.getByTestId("reference-update-toast-stability")).toBeVisible({ timeout: 15000 });
    }).toPass({ timeout: 120000, intervals: [1000, 2000, 5000] });

    await expectNoStorybookRuntimeErrorDom(page);
    expect(runtimeErrors.pageErrors).toEqual([]);
  } finally {
    runtimeErrors.dispose();
  }
}

test.describe("Storybook update Toast stability", () => {
  test("keeps update notification widths stable across progress and ready states", async ({ page }) => {
    await openShellOverlayStory(page);

    const boxes = await Promise.all(
      updateToastTestIds.map(async (testId) => {
        const toast = page.getByTestId(testId);
        await expect(toast).toBeVisible();
        const box = await toast.boundingBox();
        if (!box) {
          throw new Error(`Expected ${testId} to have a measurable box.`);
        }
        return box;
      }),
    );

    const [baselineBox, ...comparisonBoxes] = boxes;

    for (const box of comparisonBoxes) {
      expect(box.width).toBeCloseTo(baselineBox.width, 2);
    }
  });

  test("allows the shell overlay story to scroll when the viewport is short", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await openShellOverlayStory(page);

    const before = await page.evaluate(() => ({
      scrollY: window.scrollY,
      scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
      clientHeight: document.scrollingElement?.clientHeight ?? 0,
    }));

    await page.evaluate(() => window.scrollTo(0, 1200));

    const after = await page.evaluate(() => ({
      scrollY: window.scrollY,
      scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
      clientHeight: document.scrollingElement?.clientHeight ?? 0,
    }));

    expect(before.scrollHeight).toBeGreaterThan(before.clientHeight);
    expect(after.scrollY).toBeGreaterThan(before.scrollY);
  });
});
