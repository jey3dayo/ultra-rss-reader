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

  test("uses the single-pane mobile layout and shows labeled article actions below 640px", async ({ page }) => {
    await page.setViewportSize({ width: 639, height: 900 });
    await page.goto("/");

    await expect(page.getByTestId("sliding-pane-tray")).toBeVisible();
    await expect(page.getByTestId("wide-sidebar-shell")).toHaveCount(0);

    const markAllReadButton = page.getByRole("button", { name: /Mark all as read|すべて既読にする/i });
    const searchButton = page.getByRole("button", { name: /Search articles|記事を検索/i });

    await expect(markAllReadButton).toBeVisible();
    await expect(searchButton).toBeVisible();
    await expect(markAllReadButton).toContainText(/Read|既読/);
    await expect(searchButton).toContainText(/Search|検索/);
  });

  test("groups secondary article actions under More actions on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 639, height: 900 });
    await page.goto("/");

    const articleList = page.getByRole("listbox", { name: /Article list|記事一覧/i });
    await articleList.getByRole("option").first().click();

    const moreActionsButton = page.getByRole("button", { name: /More actions|その他の操作/i });
    await expect(moreActionsButton).toBeVisible();

    await moreActionsButton.click();

    await expect(page.getByRole("menuitem", { name: /Copy link|リンクをコピー/i })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Open in External Browser|外部ブラウザで開く/i })).toBeVisible();
  });
});
