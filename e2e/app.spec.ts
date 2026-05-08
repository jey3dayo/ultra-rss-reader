import { expect, type Page, test } from "@playwright/test";

const starredSmartViewButtonName = /^(starred|スター)(\s+\d+)?$/i;
const unreadSmartViewButtonName = /^(unread|未読)(\s+\d+)?$/i;
const subscriptionsReviewFilterButtonName = /(Needs review|要確認)\s*を表示/i;
const subscriptionsInventoryHeadingName = /All subscriptions|全購読/i;
const subscriptionsReviewHeadingName = /Needs review|要確認/i;

function subscriptionRows(page: Page) {
  return page.locator('[data-testid^="subscriptions-folder-tree-rail-"] button');
}

async function openSubscriptionsIndex(page: Page) {
  const showSidebarButton = page.getByRole("button", { name: /Show sidebar|サイドバーを表示/i });
  if (await showSidebarButton.isVisible().catch(() => false)) {
    await showSidebarButton.click();
  }

  const manageSubscriptionsButton = page.getByRole("button", { name: /Manage Subscriptions|購読を管理/i });
  await manageSubscriptionsButton.waitFor({ state: "visible" });
  await manageSubscriptionsButton.click();

  await expect(
    page.getByTestId("workspace-header-title-group").getByRole("heading", { name: /^Subscriptions$|^購読一覧$/i }),
  ).toBeVisible();
}

async function openSubscriptionReview(page: Page) {
  await openSubscriptionsIndex(page);
  await page.getByRole("button", { name: subscriptionsReviewFilterButtonName }).click();

  await expect(page.getByRole("heading", { name: subscriptionsReviewHeadingName })).toBeVisible();
}

async function openSubscriptionInventory(page: Page) {
  await openSubscriptionsIndex(page);

  await expect(page.getByRole("heading", { name: subscriptionsInventoryHeadingName })).toBeVisible();
  await expect(subscriptionRows(page).first()).toBeVisible();
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

  test("uses the light theme baseline by default", async ({ page }) => {
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    expect(bgColor).not.toBe("rgb(28, 25, 21)");
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

  test("uses the single-pane mobile layout and exposes article actions on narrow viewports", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/");

    await expect(page.getByTestId("sliding-pane-tray")).toBeVisible();
    await expect(page.getByTestId("wide-sidebar-shell")).toHaveCount(0);

    const markAllReadButton = page.getByRole("button", { name: /Mark all as read|すべて既読にする/i });
    const searchButton = page.getByRole("button", { name: /Search articles|記事を検索/i });

    await expect(markAllReadButton).toBeVisible();
    await expect(searchButton).toBeVisible();
    await expect(markAllReadButton).not.toContainText(/Read|既読/);
    await expect(searchButton).not.toContainText(/Search|検索/);

    const mobilePaneMetrics = await markAllReadButton.evaluate(() => {
      const tray = document.querySelector<HTMLElement>('[data-testid="sliding-pane-tray"]');
      const viewport = tray?.parentElement;
      if (!viewport) {
        return null;
      }
      return {
        scrollLeft: viewport.scrollLeft,
      };
    });

    expect(mobilePaneMetrics).not.toBeNull();
    expect(mobilePaneMetrics?.scrollLeft).toBe(0);
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

  test("opens subscription review from the subscriptions index and shows split review controls", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await openSubscriptionReview(page);

    await expect(page.getByRole("heading", { name: subscriptionsReviewHeadingName })).toBeVisible();
    await expect(page.getByRole("button", { name: subscriptionsReviewFilterButtonName })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("subscriptions-detail-pane")).toBeVisible();
  });

  test("keeps subscription detail actions below the inventory heading on narrow screens", async ({ page }) => {
    await page.setViewportSize({ width: 639, height: 900 });
    await page.goto("/");

    await openSubscriptionInventory(page);

    const detailActions = page
      .locator('[data-testid="subscriptions-detail-decision-bar"], [data-testid="subscriptions-detail-management-bar"]')
      .first();
    const inventoryHeading = page.getByRole("heading", { name: subscriptionsInventoryHeadingName });

    await expect(detailActions).toBeVisible();
    await expect(inventoryHeading).toBeVisible();

    const actionBox = await detailActions.boundingBox();
    const headingBox = await inventoryHeading.boundingBox();

    expect(actionBox).not.toBeNull();
    expect(headingBox).not.toBeNull();

    if (!actionBox || !headingBox) {
      throw new Error("Expected subscription detail controls to have measurable bounds.");
    }

    expect(actionBox.y).toBeGreaterThan(headingBox.y);
  });

  test("keeps the first subscription row fixed when selection state changes", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await openSubscriptionInventory(page);
    await expect(page.getByRole("heading", { name: subscriptionsInventoryHeadingName })).toBeVisible();

    const rows = subscriptionRows(page);
    const firstRow = rows.first();

    const rowBefore = await firstRow.boundingBox();
    await firstRow.click();
    const rowAfter = await firstRow.boundingBox();

    expect(rowBefore).not.toBeNull();
    expect(rowAfter).not.toBeNull();

    if (!rowBefore || !rowAfter) {
      throw new Error("Expected subscription rows to have measurable bounds.");
    }

    expect(rowAfter.y).toBe(rowBefore.y);
  });

  test("keeps the first subscription row fixed on narrow screens when selection state changes", async ({ page }) => {
    await page.setViewportSize({ width: 639, height: 900 });
    await page.goto("/");

    await openSubscriptionInventory(page);

    const rows = subscriptionRows(page);
    const firstRow = rows.first();

    const rowBefore = await firstRow.boundingBox();
    await firstRow.click();
    const rowAfter = await firstRow.boundingBox();

    expect(rowBefore).not.toBeNull();
    expect(rowAfter).not.toBeNull();

    if (!rowBefore || !rowAfter) {
      throw new Error("Expected subscription rows to have measurable bounds.");
    }

    expect(rowAfter.y).toBe(rowBefore.y);
  });

  test("aligns the subscription rail and rows to the same right content edge", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await openSubscriptionInventory(page);
    await expect(page.getByRole("heading", { name: subscriptionsInventoryHeadingName })).toBeVisible();

    const subscriptionRail = page.locator('[data-testid^="subscriptions-folder-tree-rail-"]').first();
    const firstRow = subscriptionRows(page).first();

    const railBox = await subscriptionRail.boundingBox();
    const rowBox = await firstRow.boundingBox();

    expect(railBox).not.toBeNull();
    expect(rowBox).not.toBeNull();

    if (!railBox || !rowBox) {
      throw new Error("Expected subscription rail and rows to have measurable bounds.");
    }

    expect(Math.abs(railBox.x + railBox.width - (rowBox.x + rowBox.width))).toBeLessThanOrEqual(1);
  });
});
