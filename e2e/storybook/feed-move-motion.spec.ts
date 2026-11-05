import { expect, type Page, test } from "@playwright/test";
import { getStorybookIframeUrl } from "./storybook-index-payload";

const storyId = "reader-sidebar-feedtreeview--feed-move-motion-worst-case";

type RecordedAnimation = { target: string; properties: string[] };

// Record every Element.animate call; the motion durations are too short to sample live animations reliably.
async function recordAnimateCalls(page: Page) {
  await page.addInitScript(() => {
    const calls: { target: string; properties: string[] }[] = [];
    Object.assign(window, { feedMoveAnimateCalls: calls });
    const original = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, keyframes, options) {
      const frames = Array.isArray(keyframes) ? keyframes : keyframes ? [keyframes] : [];
      calls.push({
        target: this.cloneNode(false) instanceof Element ? (this.cloneNode(false) as Element).outerHTML : "",
        properties: [...new Set(frames.flatMap((frame) => Object.keys(frame as object)))],
      });
      return original.call(this, keyframes, options);
    };
  });
}

for (const reduced of [false, true]) {
  test(`feed move uses ${reduced ? "opacity only with reduced motion" : "FLIP and fade"}`, async ({ page }) => {
    await recordAnimateCalls(page);
    await page.emulateMedia({ reducedMotion: reduced ? "reduce" : "no-preference" });
    await page.goto(getStorybookIframeUrl(storyId));
    await expect(page.getByTestId("move-between-folders")).toBeVisible();
    await page.evaluate(async () => {
      await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
      (Reflect.get(window, "feedMoveAnimateCalls") as unknown[]).length = 0;
    });

    await page.getByTestId("move-between-folders").click();

    await expect
      .poll(() =>
        page.evaluate(() =>
          (Reflect.get(window, "feedMoveAnimateCalls") as RecordedAnimation[]).some((call) =>
            call.properties.includes("opacity"),
          ),
        ),
      )
      .toBe(true);
    const calls = await page.evaluate(() => Reflect.get(window, "feedMoveAnimateCalls") as RecordedAnimation[]);

    // The moved row's button fades in.
    expect(
      calls.some(
        (call) => call.target.includes('data-feed-id="motion-feed-0-0"') && call.properties.includes("opacity"),
      ),
    ).toBe(true);
    const transforms = calls.filter((call) => call.properties.includes("transform"));
    if (reduced) {
      expect(transforms).toHaveLength(0);
    } else {
      // Displaced feed or folder rows slide with a FLIP transform.
      expect(
        transforms.some(
          (call) => call.target.includes("data-feed-row-id") || call.target.includes("data-folder-row-id"),
        ),
      ).toBe(true);
    }

    await expect(
      page.locator('[data-folder-reorder-folder-id="motion-folder-1"] [data-feed-row-id="motion-feed-0-0"]'),
    ).toBeVisible();
  });
}
