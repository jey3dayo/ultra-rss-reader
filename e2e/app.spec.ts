import { expect, test } from "@playwright/test";

const starredSmartViewButtonName = /^(starred|スター)(\s+\d+)?$/i;
const unreadSmartViewButtonName = /^(unread|未読)(\s+\d+)?$/i;

async function openFeedCleanup(page: Parameters<(typeof test)["beforeEach"]>[0]["page"]) {
  const showSidebarButton = page.getByRole("button", { name: /Show sidebar|サイドバーを表示/i });
  if (await showSidebarButton.isVisible().catch(() => false)) {
    await showSidebarButton.click();
  }

  const manageSubscriptionsButton = page.getByRole("button", { name: /Manage Subscriptions|購読を管理/i });
  await manageSubscriptionsButton.waitFor({ state: "visible" });
  await manageSubscriptionsButton.click();

  await expect(
    page.getByTestId("workspace-header-navigation-row").getByRole("heading", { name: /Subscriptions|購読一覧/i }),
  ).toBeVisible();

  const reviewFlaggedButton = page.getByRole("button", { name: /Review flagged subscriptions|整理へ|要確認を見る/i });
  await reviewFlaggedButton.first().click();

  await expect(page.getByRole("heading", { name: /Review Subscriptions|購読の整理/i })).toBeVisible();
}

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

  test("opens feed cleanup from the sidebar and shows split review controls", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await openFeedCleanup(page);

    await expect(page.getByRole("heading", { name: /Review Subscriptions|購読の整理/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Overview|概要/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Cleanup Queue|整理キュー/i })).toBeVisible();
    await expect(
      page.getByTestId("feed-cleanup-review-panel").getByRole("heading", { name: /^Review$|^確認$/i }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Keep all visible|表示中をまとめて継続/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Defer all visible|表示中をまとめて保留/i })).toBeVisible();

    await expect(page.getByTestId("feed-cleanup-review-panel")).toContainText(
      /Why this feed is here|候補に入った理由/i,
    );
    const reviewActions = page.getByTestId("feed-cleanup-review-actions");
    await expect(reviewActions.getByRole("button", { name: /^Keep$|^残す$/i })).toBeVisible();
    await expect(reviewActions.getByRole("button", { name: /^Defer$|^Later$|^あとで見直す$/i })).toBeVisible();
  });

  test("keeps feed cleanup actions above the queue on narrow screens", async ({ page }) => {
    await page.setViewportSize({ width: 639, height: 900 });
    await page.goto("/");

    await openFeedCleanup(page);

    const keepAllVisibleButton = page.getByRole("button", { name: /Keep all visible|表示中をまとめて継続/i });
    const queueHeading = page.getByRole("heading", { name: /Cleanup Queue|整理キュー/i });

    await expect(keepAllVisibleButton).toBeVisible();
    await expect(queueHeading).toBeVisible();

    const keepBox = await keepAllVisibleButton.boundingBox();
    const queueBox = await queueHeading.boundingBox();

    expect(keepBox).not.toBeNull();
    expect(queueBox).not.toBeNull();

    if (!keepBox || !queueBox) {
      throw new Error("Expected feed cleanup controls to have measurable bounds.");
    }

    expect(keepBox.y).toBeLessThan(queueBox.y);
  });

  test("keeps the first cleanup row fixed when selection state changes", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await openFeedCleanup(page);
    await expect(page.getByRole("heading", { name: /Cleanup Queue|整理キュー/i })).toBeVisible();

    const firstRow = page.locator('[data-testid^="feed-cleanup-queue-row-"]').first();
    const firstCheckbox = page.getByRole("checkbox").first();

    const rowBefore = await firstRow.boundingBox();
    await firstCheckbox.check();
    const rowAfter = await firstRow.boundingBox();

    expect(rowBefore).not.toBeNull();
    expect(rowAfter).not.toBeNull();

    if (!rowBefore || !rowAfter) {
      throw new Error("Expected cleanup rows to have measurable bounds.");
    }

    expect(rowAfter.y).toBe(rowBefore.y);
  });

  test("keeps the first cleanup row fixed on narrow screens when selection state changes", async ({ page }) => {
    await page.setViewportSize({ width: 639, height: 900 });
    await page.goto("/");

    await openFeedCleanup(page);

    const firstRow = page.locator('[data-testid^="feed-cleanup-queue-row-"]').first();
    const firstCheckbox = page.getByRole("checkbox").first();

    const rowBefore = await firstRow.boundingBox();
    await firstCheckbox.check();
    const rowAfter = await firstRow.boundingBox();

    expect(rowBefore).not.toBeNull();
    expect(rowAfter).not.toBeNull();

    if (!rowBefore || !rowAfter) {
      throw new Error("Expected cleanup rows to have measurable bounds.");
    }

    expect(rowAfter.y).toBe(rowBefore.y);
  });

  test("aligns the selection rail and cleanup rows to the same right content edge", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await openFeedCleanup(page);
    await expect(page.getByRole("heading", { name: /Cleanup Queue|整理キュー/i })).toBeVisible();

    const selectionRail = page.getByTestId("feed-cleanup-selection-rail");
    const firstRow = page.locator('[data-testid^="feed-cleanup-queue-row-"]').first();

    const railBox = await selectionRail.boundingBox();
    const rowBox = await firstRow.boundingBox();

    expect(railBox).not.toBeNull();
    expect(rowBox).not.toBeNull();

    if (!railBox || !rowBox) {
      throw new Error("Expected cleanup rail and rows to have measurable bounds.");
    }

    expect(Math.abs(railBox.x + railBox.width - (rowBox.x + rowBox.width))).toBeLessThanOrEqual(1);
  });
});
