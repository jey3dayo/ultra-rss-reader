import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { expectNoStorybookRuntimeErrorDom } from "../helpers/runtime-error-guard";
import { getStorybookIframeUrl, getStorybookIndexStoryIds } from "./storybook-index-payload";

const index: unknown = JSON.parse(readFileSync("storybook-static/index.json", "utf8"));
const storyIds = getStorybookIndexStoryIds(index);
if (storyIds.length === 0) throw new Error("Static Storybook contains no stories to audit");

for (const storyId of storyIds) {
  test(`axe ${storyId}`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(getStorybookIframeUrl(storyId));
    await expect(page.locator("body")).toHaveClass(/sb-show-main/);
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
    expect(results.violations, `Accessibility violations in ${storyId}`).toEqual([]);
  });
}
