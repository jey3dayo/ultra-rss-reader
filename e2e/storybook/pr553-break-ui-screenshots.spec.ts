import { expect, test, type Page } from "@playwright/test";
import { getStorybookIframeUrl } from "./storybook-index-payload";

type CaptureCase = {
  slug: string;
  storyId: string;
  selector: string;
  viewport: { width: number; height: number };
};

const captureCases: CaptureCase[] = [
  {
    slug: "sidebar-default",
    storyId: "reader-sidebar-feedtreeview--default",
    selector: "#storybook-root",
    viewport: { width: 280, height: 640 },
  },
  {
    slug: "sidebar-worst-case-unread-240px",
    storyId: "reader-sidebar-feedtreeview--worst-case-unread-counts",
    selector: "[data-testid='feed-tree-break-ui-worst-case']",
    viewport: { width: 256, height: 480 },
  },
  {
    slug: "article-worst-case-typography",
    storyId: "reader-article-articlecontentview--worst-case-article-typography",
    selector: "[data-testid='article-content-worst-case-typography']",
    viewport: { width: 784, height: 900 },
  },
];

async function applyTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((nextTheme) => {
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.style.setProperty(
      "--theme-canvas",
      nextTheme === "dark" ? "#1c1915" : "#f2f1ed",
    );
    document.body.style.backgroundColor = nextTheme === "dark" ? "#1c1915" : "#f2f1ed";
  }, theme);
}

async function openStory(page: Page, storyId: string, selector: string) {
  await page.goto(getStorybookIframeUrl(storyId), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.locator(selector).first()).toBeVisible({ timeout: 60_000 });
}

test.describe("PR553 break-ui verification screenshots", () => {
  for (const captureCase of captureCases) {
    for (const theme of ["light", "dark"] as const) {
      test(`${captureCase.slug} ${theme}`, async ({ page }, testInfo) => {
        await page.setViewportSize(captureCase.viewport);
        await openStory(page, captureCase.storyId, captureCase.selector);
        await applyTheme(page, theme);
        await page.locator(captureCase.selector).first().screenshot({
          path: testInfo.outputPath(`after-${captureCase.slug}-${theme}.png`),
        });
      });
    }
  }
});
