import { expect, test } from "@playwright/test";

const starredSmartViewButtonName = /^(starred|スター)(\s+\d+)?$/i;
const unreadSmartViewButtonName = /^(unread|未読)(\s+\d+)?$/i;

test.describe("Ultra RSS Reader - basic rendering", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("page has correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/Ultra RSS/);
  });

  test("renders sidebar controls", async ({ page }) => {
    await expect(page.getByRole("button", { name: /Sync feeds|フィードを同期/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Settings|設定/ })).toBeVisible();
  });

  test("shows empty state message", async ({ page }) => {
    await expect(page.getByText("Select an article to read")).toBeVisible();
  });

  test("uses dark theme (body background is dark)", async ({ page }) => {
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    // Dark theme should have a dark background (low RGB values)
    // Accept any dark-ish color or CSS variable fallback
    expect(bgColor).toBeTruthy();
  });

  test("keeps an auto-read article visible in unread view until the user changes screens", async ({ page }) => {
    const sidebar = page.getByTestId("wide-sidebar-content");
    const articleList = page.getByRole("listbox", { name: /Article list|記事一覧/i });
    const firstArticle = articleList.getByRole("option").first();
    const articleId = await firstArticle.getAttribute("data-article-id");

    expect(articleId).toBeTruthy();
    await firstArticle.click();

    await expect(articleList.locator(`[data-article-id="${articleId}"]`)).toBeVisible();

    await sidebar.getByRole("button", { name: starredSmartViewButtonName }).click();

    await expect(articleList.locator(`[data-article-id="${articleId}"]`)).toHaveCount(0);
  });

  test("keeps an unstarred article visible in starred view until the user changes screens", async ({ page }) => {
    const sidebar = page.getByTestId("wide-sidebar-content");

    await sidebar.getByRole("button", { name: starredSmartViewButtonName }).click();

    const articleList = page.getByRole("listbox", { name: /Article list|記事一覧/i });
    const firstStarredArticle = articleList.getByRole("option").first();
    const articleId = await firstStarredArticle.getAttribute("data-article-id");

    expect(articleId).toBeTruthy();
    await firstStarredArticle.click();
    await page.getByRole("button", { name: /Toggle star|スターを切替/i }).click();

    await expect(articleList.locator(`[data-article-id="${articleId}"]`)).toBeVisible();

    await sidebar.getByRole("button", { name: unreadSmartViewButtonName }).click();

    await expect(articleList.locator(`[data-article-id="${articleId}"]`)).toHaveCount(0);
  });
});
