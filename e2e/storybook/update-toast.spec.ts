import { expect, test } from "@playwright/test";

const updateToastTestIds = [
  "reference-update-toast-download-0",
  "reference-update-toast-download-90",
  "reference-update-toast-ready",
] as const;

test.describe("Storybook update Toast stability", () => {
  test("keeps update notification widths stable across progress and ready states", async ({ page }) => {
    await page.goto("/iframe.html?id=ui-reference-shell-overlay-canvas--default");

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
    await page.goto("/iframe.html?id=ui-reference-shell-overlay-canvas--default");
    await expect(page.getByTestId("reference-update-toast-stability")).toBeVisible();

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
