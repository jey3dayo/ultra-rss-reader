import { expect, type Page, test } from "@playwright/test";
import {
  expectNoRuntimeErrors,
  expectNoStorybookRuntimeErrorDom,
  installRuntimeErrorGuard,
} from "../helpers/runtime-error-guard";
import {
  getStorybookIframeUrl,
  getStorybookIndexStoryIds,
  visualRegressionSmokeStoryIds,
} from "./storybook-index-payload";

type VisualSmokeCase = {
  storyId: (typeof visualRegressionSmokeStoryIds)[number];
  snapshotName: `${string}.png`;
  readySelector: string;
  screenshotSelector: string;
};

const storybookIndexUrl = "/index.json";
const visualSmokeCases = [
  {
    storyId: "reader-sidebar-feedtreeview--dense-narrow-a-11-y-state",
    snapshotName: "feed-tree-dense-a11y-state.png",
    readySelector: "[data-testid='feed-tree-dense-smoke']",
    screenshotSelector: "[data-testid='feed-tree-dense-smoke']",
  },
  {
    storyId: "settings-page-accountdetailview--dense-a-11-y-disabled-state",
    snapshotName: "settings-account-a11y-disabled-state.png",
    readySelector: "#storybook-root > *",
    screenshotSelector: "#storybook-root > *",
  },
  {
    storyId: "primitives-command--results",
    snapshotName: "command-palette-results-state.png",
    readySelector: "[data-testid='command-results-smoke']",
    screenshotSelector: "[data-testid='command-results-smoke']",
  },
  {
    storyId: "primitives-command--empty",
    snapshotName: "command-palette-empty-state.png",
    readySelector: "[data-testid='command-empty-smoke'] [data-slot='command-empty']",
    screenshotSelector: "[data-testid='command-empty-smoke']",
  },
  {
    storyId: "reader-browser-browseroverlaystage--retryable-issue",
    snapshotName: "browser-overlay-retryable-error-state.png",
    readySelector: "[data-testid='browser-surface-state']",
    screenshotSelector: "[data-testid='browser-surface-state']",
  },
] satisfies readonly VisualSmokeCase[];

const expectedVisualSmokeStoryIdSet = new Set<string>(visualRegressionSmokeStoryIds);

function getMissingExpectedStoryIds(registryStoryIds: Iterable<string>): readonly string[] {
  const storyRegistry = new Set(registryStoryIds);
  return visualRegressionSmokeStoryIds.filter((storyId) => !storyRegistry.has(storyId));
}

function getUnknownVisualSmokeStoryIds(cases: readonly VisualSmokeCase[]): string[] {
  return cases.flatMap(({ storyId }) => (expectedVisualSmokeStoryIdSet.has(storyId) ? [] : [storyId]));
}

async function openVisualSmokeStory(page: Page, smokeCase: VisualSmokeCase) {
  const runtimeErrors = installRuntimeErrorGuard(page);
  const url = getStorybookIframeUrl(smokeCase.storyId);

  try {
    await expect(async () => {
      runtimeErrors.clear();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await expect(page.locator(smokeCase.readySelector).first()).toBeVisible({
        timeout: 15000,
      });
    }).toPass({ timeout: 120000, intervals: [1000, 2000, 5000] });

    await expectNoStorybookRuntimeErrorDom(page);
    expectNoRuntimeErrors(page);
  } finally {
    runtimeErrors.dispose();
  }
}

test.describe("Storybook dense UI and a11y visual smoke", () => {
  test.beforeAll("verifies visual smoke stories exist in Storybook registry", async ({ request }) => {
    await expect(async () => {
      const response = await request.get(storybookIndexUrl, {
        timeout: 15000,
      });
      expect(response.ok()).toBe(true);

      const payload: unknown = await response.json();
      const registryStoryIds = getStorybookIndexStoryIds(payload);
      const missingStoryIds = getMissingExpectedStoryIds(registryStoryIds);
      const unknownStoryIds = getUnknownVisualSmokeStoryIds(visualSmokeCases);

      expect(missingStoryIds).toEqual([]);
      expect(unknownStoryIds).toEqual([]);
    }).toPass({ timeout: 120000, intervals: [1000, 2000, 5000] });
  });

  for (const smokeCase of visualSmokeCases) {
    test(`captures ${smokeCase.storyId}`, async ({ page }) => {
      await openVisualSmokeStory(page, smokeCase);

      await expect(page.locator(smokeCase.screenshotSelector).first()).toHaveScreenshot(smokeCase.snapshotName, {
        animations: "disabled",
      });
    });
  }
});
