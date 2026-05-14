import { expect, type Page, test } from "@playwright/test";
import { expectMeasurableBox } from "../helpers/measurable-box";
import {
  expectNoRuntimeErrors,
  expectNoStorybookRuntimeErrorDom,
  installRuntimeErrorGuard,
} from "../helpers/runtime-error-guard";

const updateToastTestIds = [
  "reference-update-toast-download-0",
  "reference-update-toast-download-90",
  "reference-update-toast-ready",
] as const;

const updateToastLayoutTestIds = [...updateToastTestIds, "reference-update-toast-failure"] as const;

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
    expectNoRuntimeErrors(page);
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
        return expectMeasurableBox(toast, testId);
      }),
    );

    const [baselineBox, ...comparisonBoxes] = boxes;

    for (const box of comparisonBoxes) {
      expect(Math.abs(box.width - baselineBox.width)).toBeLessThanOrEqual(1);
    }
  });

  test("wraps update notification specimens without overlap at the reference viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openShellOverlayStory(page);

    const boxes = await Promise.all(
      updateToastLayoutTestIds.map(async (testId) => ({
        testId,
        box: await expectMeasurableBox(page.getByTestId(testId), testId),
      })),
    );

    const overlaps: string[] = [];

    for (let index = 0; index < boxes.length; index += 1) {
      for (let comparisonIndex = index + 1; comparisonIndex < boxes.length; comparisonIndex += 1) {
        const current = boxes[index];
        const comparison = boxes[comparisonIndex];
        const horizontalOverlap = Math.max(
          0,
          Math.min(current.box.x + current.box.width, comparison.box.x + comparison.box.width) -
            Math.max(current.box.x, comparison.box.x),
        );
        const verticalOverlap = Math.max(
          0,
          Math.min(current.box.y + current.box.height, comparison.box.y + comparison.box.height) -
            Math.max(current.box.y, comparison.box.y),
        );

        if (horizontalOverlap > 0 && verticalOverlap > 0) {
          overlaps.push(`${current.testId} overlaps ${comparison.testId}`);
        }
      }
    }

    expect(overlaps).toEqual([]);
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
