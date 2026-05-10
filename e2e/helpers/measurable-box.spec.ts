import { expect, test } from "@playwright/test";
import { expectMeasurableBox } from "./measurable-box";

test.describe("measurable box helper", () => {
  test("reports locator and viewport details for zero-size boxes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.setContent('<div data-testid="zero-size" style="width: 0; height: 0;"></div>');

    await expect(expectMeasurableBox(page.getByTestId("zero-size"), "zero size fixture")).rejects.toThrow(
      /Expected zero size fixture to have a measurable bounding box\.[\s\S]*Locator: getByTestId\('zero-size'\)[\s\S]*Viewport: 375x667/,
    );
  });
});
