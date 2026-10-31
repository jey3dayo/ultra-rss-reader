import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { expectNoStorybookRuntimeErrorDom } from "../helpers/runtime-error-guard";
import {
  compareStorybookAccessibilityViolations,
  getUnknownAccessibilityBaselineStoryIds,
} from "./accessibility-baseline";
import {
  resolveStorybookAccessibilityViewport,
  type StorybookAccessibilityViewportContext,
} from "./accessibility-viewport";
import { getStorybookIframeUrl, getStorybookIndexStoryIds } from "./storybook-index-payload";

const index: unknown = JSON.parse(readFileSync("storybook-static/index.json", "utf8"));
const storyIds = getStorybookIndexStoryIds(index);
if (storyIds.length === 0) throw new Error("Static Storybook contains no stories to audit");
const finiteAnimationWaitTimeoutMs = 5000;

function getA11yAuditIframeUrl(storyId: string): string {
  const url = new URL(getStorybookIframeUrl(storyId), "http://storybook.local");
  url.searchParams.set("globals", "a11y.manual:!true");

  return `${url.pathname}${url.search}`;
}

async function waitForFiniteAnimations(page: Page): Promise<void> {
  const animationsSettled = await page.evaluate(async (timeoutMs) => {
    const finiteAnimations = document.getAnimations().filter((animation) => {
      const endTime = animation.effect?.getComputedTiming().endTime;
      return Number.isFinite(endTime) && (animation.playState === "running" || animation.pending);
    });

    if (finiteAnimations.length === 0) return true;

    return new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => resolve(false), timeoutMs);
      void Promise.all(finiteAnimations.map((animation) => animation.finished.catch(() => undefined))).then(() => {
        window.clearTimeout(timeout);
        resolve(true);
      });
    });
  }, finiteAnimationWaitTimeoutMs);

  expect(animationsSettled, `Finite story animations should finish within ${finiteAnimationWaitTimeoutMs} ms`).toBe(
    true,
  );
}

async function waitForStoryRender(page: Page, storyId: string): Promise<void> {
  const renderPhase = await page.waitForFunction(
    () => {
      const preview: unknown = Reflect.get(window, "__STORYBOOK_PREVIEW__");
      if (typeof preview !== "object" || preview === null) return false;
      const render: unknown = Reflect.get(preview, "currentRender");
      if (typeof render !== "object" || render === null) return false;
      const phase: unknown = Reflect.get(render, "phase");
      return phase === "finished" || phase === "errored" || phase === "aborted" ? phase : false;
    },
    undefined,
    { timeout: 10_000 },
  );
  expect(await renderPhase.jsonValue(), `Story ${storyId} must complete its play function`).toBe("finished");
  await expect(page.locator("body")).toHaveClass(/sb-show-main/);
}

async function getStorybookViewportContext(
  page: Page,
  storyId: string,
): Promise<StorybookAccessibilityViewportContext> {
  return page.evaluate((expectedStoryId) => {
    function isRecord(value: unknown): value is Record<string, unknown> {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    function getProperty(record: unknown, key: string): unknown {
      return isRecord(record) ? Reflect.get(record, key) : undefined;
    }

    const preview: unknown = Reflect.get(window, "__STORYBOOK_PREVIEW__");
    const render = getProperty(preview, "currentRender");
    const story = getProperty(render, "story");
    if (!isRecord(story) || Reflect.get(story, "id") !== expectedStoryId) {
      throw new Error(`Storybook preview did not expose the expected story "${expectedStoryId}" after render`);
    }

    const storyStore = getProperty(preview, "storyStore");
    const getStoryContext = getProperty(storyStore, "getStoryContext");
    if (typeof getStoryContext !== "function") {
      throw new Error(`Storybook preview did not expose story context for "${expectedStoryId}"`);
    }
    const storyContext: unknown = Reflect.apply(getStoryContext, storyStore, [story]);
    if (!isRecord(storyContext)) {
      throw new Error(`Storybook returned invalid context for "${expectedStoryId}"`);
    }

    return {
      globals: getProperty(storyContext, "globals"),
      storyGlobals: getProperty(storyContext, "storyGlobals"),
      userGlobals: getProperty(storyContext, "userGlobals"),
      parameters: {
        viewport: getProperty(getProperty(storyContext, "parameters"), "viewport"),
      },
    };
  }, storyId);
}

test("accessibility baseline references existing stories", () => {
  expect(getUnknownAccessibilityBaselineStoryIds(storyIds), "Remove baseline entries for deleted stories").toEqual([]);
});

for (const storyId of storyIds) {
  test(`axe ${storyId}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(getA11yAuditIframeUrl(storyId));
    await waitForStoryRender(page, storyId);
    const viewport = resolveStorybookAccessibilityViewport(storyId, await getStorybookViewportContext(page, storyId));
    if (viewport) {
      await page.setViewportSize(viewport);
      await page.reload();
      await waitForStoryRender(page, storyId);
    }
    await waitForFiniteAnimations(page);
    await expectNoStorybookRuntimeErrorDom(page);
    expect(errors, "Story must render successfully before the accessibility audit").toEqual([]);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(errors, "Story runtime errors during the accessibility audit").toEqual([]);
    if (results.violations.length > 0) {
      await testInfo.attach("axe-violations", {
        body: JSON.stringify(results.violations, null, 2),
        contentType: "application/json",
      });
    }
    const baselineDrift = compareStorybookAccessibilityViolations(storyId, results.violations);
    expect(baselineDrift, `Accessibility baseline drift: ${JSON.stringify(baselineDrift)}`).toEqual({
      unexpected: [],
      stale: [],
    });
  });
}
