import { expect, test } from "@playwright/test";

test("long settings help fits a narrow, enlarged, low-height viewport and scrolls to its final instructions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 320 });
  await page.goto("/iframe.html?id=ui-reference-input-controls-canvas--long-help-viewport&viewMode=story");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "20px";
  });

  const trigger = page.getByRole("button", { name: "About publication dates" });
  await trigger.press("Enter");

  const popup = page.getByRole("dialog", { name: "Publication date details" });
  const scrollRegion = popup.locator('[data-surface-card="info"]');
  await expect(popup).toBeVisible();
  const bounds = await popup.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(360);
  expect(bounds.bottom).toBeLessThanOrEqual(320);

  await page.keyboard.press("Tab");
  await expect(scrollRegion).toBeFocused();
  await page.keyboard.press("End");

  const isScrollable = await scrollRegion.evaluate((element) => element.scrollHeight > element.clientHeight);
  expect(isScrollable).toBe(true);
  await expect(page.getByTestId("settings-info-popover-final-instructions")).toBeInViewport();
});
