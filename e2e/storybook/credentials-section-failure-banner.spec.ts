import { expect, test } from "@playwright/test";

const credentialsSectionFailureStoryId = "settings-section-accountcredentialssectionview--section-failure";
const minimumFailureBannerHeightPx = 44;

async function applyStoryTheme(page: import("@playwright/test").Page, theme: "light" | "dark") {
  await page.evaluate((resolvedTheme) => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    document.documentElement.style.colorScheme = resolvedTheme;
  }, theme);
}

test.describe("credentials section failure banner", () => {
  for (const theme of ["light", "dark"] as const) {
    test(`renders with balanced padding in ${theme} theme`, async ({ page }) => {
      await page.goto(`/iframe.html?id=${credentialsSectionFailureStoryId}&viewMode=story`, {
        waitUntil: "domcontentloaded",
      });
      await applyStoryTheme(page, theme);

      const alert = page.getByRole("alert");
      await expect(alert).toBeVisible();
      await expect(alert).toContainText("Connection failed: Cannot reach server");

      const metrics = await alert.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          height: element.getBoundingClientRect().height,
          paddingTop: Number.parseFloat(styles.paddingTop),
          paddingBottom: Number.parseFloat(styles.paddingBottom),
        };
      });

      expect(metrics.height).toBeGreaterThanOrEqual(minimumFailureBannerHeightPx);
      expect(metrics.paddingBottom).toBeGreaterThanOrEqual(10);
      expect(Math.abs(metrics.paddingTop - metrics.paddingBottom)).toBeLessThanOrEqual(2);

      await alert.screenshot({
        path: `/opt/cursor/artifacts/storybook-account-credentials-section-failure-${theme}.png`,
      });
    });
  }
});
