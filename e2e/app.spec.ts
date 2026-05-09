import { expect, type Locator, type Page, test } from "@playwright/test";
import { expectMeasurableBox } from "./helpers/measurable-box";
import {
  disposeRuntimeErrorGuard,
  expectNoRuntimeErrors,
  installRuntimeErrorGuard,
} from "./helpers/runtime-error-guard";

const starredSmartViewButtonName = /^(starred|スター)(\s+\d+)?$/i;
const unreadSmartViewButtonName = /^(unread|未読)(\s+\d+)?$/i;
const subscriptionsReviewFilterButtonName = /(Needs review|要確認)\s*を表示/i;
const subscriptionsInventoryHeadingName = /All subscriptions|全購読/i;
const subscriptionsReviewHeadingName = /Needs review|要確認/i;
const appLayoutHiddenPaneSelector = [
  '[data-testid="compact-account-pane-shell"][aria-hidden="true"]',
  '[data-testid="wide-account-pane-content"][aria-hidden="true"]',
  '[data-testid="wide-sidebar-content"][aria-hidden="true"]',
  '[data-testid="sliding-pane-tray"] > [aria-hidden="true"]',
].join(",");
const focusableSelector = [
  "a[href]",
  "area[href]",
  "button",
  "input",
  "select",
  "textarea",
  "summary",
  "iframe",
  "object",
  "embed",
  "audio[controls]",
  "video[controls]",
  "[contenteditable]",
  "[tabindex]",
].join(",");

function subscriptionRows(page: Page) {
  return page.locator(
    '[data-testid^="subscriptions-folder-tree-rail-"] button',
  );
}

async function expectLocatorsVisibleInParallel(locators: Locator[]) {
  await Promise.all(locators.map((locator) => expect(locator).toBeVisible()));
}

async function routeImagesToEmptyResponses(page: Page) {
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() === "image") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.continue();
  });
}

async function openSubscriptionsIndex(page: Page) {
  const showSidebarButton = page.getByRole("button", {
    name: /Show sidebar|サイドバーを表示/i,
  });
  if (await showSidebarButton.isVisible().catch(() => false)) {
    await showSidebarButton.click();
  }

  // Browser state changes stay sequential; only post-navigation assertions below are parallelized.
  const manageSubscriptionsButton = page
    .locator('button:not([tabindex="-1"])')
    .filter({ hasText: /Manage Subscriptions|購読一覧/i })
    .or(
      page.locator(
        'button:not([tabindex="-1"])[aria-label="Manage Subscriptions"], button:not([tabindex="-1"])[aria-label="購読一覧"]',
      ),
    )
    .first();
  await expect(manageSubscriptionsButton).toBeVisible();
  await manageSubscriptionsButton.click();

  await expect(
    page
      .getByTestId("workspace-header-title-group")
      .getByRole("heading", { name: /^Subscriptions$|^購読一覧$/i }),
  ).toBeVisible();
}

async function openSubscriptionReview(page: Page) {
  await openSubscriptionsIndex(page);
  await page
    .getByRole("button", { name: subscriptionsReviewFilterButtonName })
    .click();

  await expect(
    page.getByRole("heading", { name: subscriptionsReviewHeadingName }),
  ).toBeVisible();
}

async function openSubscriptionInventory(page: Page) {
  await openSubscriptionsIndex(page);

  await Promise.all([
    expect(
      page.getByRole("heading", { name: subscriptionsInventoryHeadingName }),
    ).toBeVisible(),
    expect(subscriptionRows(page).first()).toBeVisible(),
  ]);
}

async function expectHiddenAppLayoutPanesBlockFocus(
  page: Page,
  expectedHiddenPaneCount: number,
) {
  await expect
    .poll(async () => page.locator(appLayoutHiddenPaneSelector).count())
    .toBeGreaterThanOrEqual(expectedHiddenPaneCount);

  const result = await page.evaluate(
    ({ hiddenPaneSelector, focusableElementSelector }) => {
      const hiddenPanes = Array.from(
        document.querySelectorAll<HTMLElement>(hiddenPaneSelector),
      );
      const focusableElements = hiddenPanes.flatMap((pane) =>
        Array.from(
          pane.querySelectorAll<HTMLElement>(focusableElementSelector),
        ),
      );
      const focusableWithoutFallback = focusableElements.filter(
        (element) => element.tabIndex !== -1,
      );
      const programmaticTarget = focusableElements[0] ?? null;

      programmaticTarget?.focus();

      return {
        hiddenPaneCount: hiddenPanes.length,
        focusableCount: focusableElements.length,
        focusableWithoutFallbackCount: focusableWithoutFallback.length,
        programmaticFocusCaptured:
          programmaticTarget !== null &&
          document.activeElement === programmaticTarget,
      };
    },
    {
      hiddenPaneSelector: appLayoutHiddenPaneSelector,
      focusableElementSelector: focusableSelector,
    },
  );

  expect(result.hiddenPaneCount).toBeGreaterThanOrEqual(
    expectedHiddenPaneCount,
  );
  expect(result.focusableCount).toBeGreaterThan(0);
  expect(result.focusableWithoutFallbackCount).toBe(0);
  expect(result.programmaticFocusCaptured).toBe(false);
}

test.describe("Ultra RSS Reader - basic rendering", () => {
  test.beforeEach(async ({ page }) => {
    installRuntimeErrorGuard(page);
    await routeImagesToEmptyResponses(page);
    await page.goto("/");
  });

  test.afterEach(async ({ page }) => {
    try {
      expectNoRuntimeErrors(page);
    } finally {
      disposeRuntimeErrorGuard(page);
    }
  });

  test("page has correct title", async ({ page }) => {
    await expect(page).toHaveTitle(/Ultra RSS/);
  });

  test("renders sidebar controls", async ({ page }) => {
    await expectLocatorsVisibleInParallel([
      page.getByRole("button", { name: /Sync feeds|フィードを同期/ }),
      page.getByRole("button", { name: /Settings|設定/ }),
    ]);
  });

  test("shows the default selection summary", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /Unread|未読/i }),
    ).toBeVisible();
  });

  test("uses the light theme baseline by default", async ({ page }) => {
    const bgColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    expect(bgColor).not.toBe("rgb(28, 25, 21)");
  });

  test("keeps an auto-read article visible in unread view until the user changes screens", async ({
    page,
  }) => {
    const sidebar = page.getByTestId("wide-sidebar-content");
    const articleList = page.getByRole("listbox", {
      name: /Article list|記事一覧/i,
    });
    const firstArticle = articleList.getByRole("option").first();
    const articleId = await firstArticle.getAttribute("data-article-id");

    expect(articleId).toBeTruthy();
    await firstArticle.click();

    await expect(
      articleList.locator(`[data-article-id="${articleId}"]`),
    ).toBeVisible();

    await sidebar
      .getByRole("button", { name: starredSmartViewButtonName })
      .click();

    await expect(
      articleList.locator(`[data-article-id="${articleId}"]`),
    ).toHaveCount(0);
  });

  test("keeps an unstarred article visible in starred view until the user changes screens", async ({
    page,
  }) => {
    const sidebar = page.getByTestId("wide-sidebar-content");

    await sidebar
      .getByRole("button", { name: starredSmartViewButtonName })
      .click();

    const articleList = page.getByRole("listbox", {
      name: /Article list|記事一覧/i,
    });
    const firstStarredArticle = articleList.getByRole("option").first();
    const articleId = await firstStarredArticle.getAttribute("data-article-id");

    expect(articleId).toBeTruthy();
    await firstStarredArticle.click();
    await page
      .getByRole("button", { name: /Toggle star|スターを切替/i })
      .click();

    await expect(
      articleList.locator(`[data-article-id="${articleId}"]`),
    ).toBeVisible();

    await sidebar
      .getByRole("button", { name: unreadSmartViewButtonName })
      .click();
    await sidebar
      .getByRole("button", { name: starredSmartViewButtonName })
      .click();

    await expect(
      articleList.locator(`[data-article-id="${articleId}"]`),
    ).toHaveCount(0);
  });

  test("uses the single-pane mobile layout and exposes article actions on narrow viewports", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/");

    await Promise.all([
      expect(page.getByTestId("sliding-pane-tray")).toBeVisible(),
      expect(page.getByTestId("wide-sidebar-shell")).toHaveCount(0),
    ]);

    const markAllReadButton = page.getByRole("button", {
      name: /Mark all as read|すべて既読にする/i,
    });
    const searchButton = page.getByRole("button", {
      name: /Search articles|記事を検索/i,
    });

    await Promise.all([
      expect(markAllReadButton).toBeVisible(),
      expect(searchButton).toBeVisible(),
      expect(markAllReadButton).not.toContainText(/Read|既読/),
      expect(searchButton).not.toContainText(/Search|検索/),
    ]);

    const mobilePaneMetrics = await markAllReadButton.evaluate(() => {
      const tray = document.querySelector<HTMLElement>(
        '[data-testid="sliding-pane-tray"]',
      );
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

  test("keeps hidden AppLayout panes out of keyboard focus across the WebView support matrix", async ({
    page,
  }) => {
    const layoutCases = [
      { name: "wide", width: 1280, expectedHiddenPaneCount: 1 },
      { name: "compact", width: 900, expectedHiddenPaneCount: 2 },
      { name: "mobile", width: 390, expectedHiddenPaneCount: 3 },
    ];

    // These cases reuse one Playwright page and intentionally stay sequential to keep browser state isolated.
    for (const layoutCase of layoutCases) {
      await test.step(layoutCase.name, async () => {
        await page.setViewportSize({ width: layoutCase.width, height: 900 });
        await page.goto("/", { waitUntil: "load" });
        await expectHiddenAppLayoutPanesBlockFocus(
          page,
          layoutCase.expectedHiddenPaneCount,
        );
      });
    }

    await test.step("subscriptions workspace", async () => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/", { waitUntil: "load" });
      const wideSidebar = page.getByTestId("wide-sidebar-content");
      await expect(wideSidebar).toBeVisible();
      await wideSidebar
        .getByRole("button", { name: /Manage Subscriptions|購読を管理/i })
        .click();
      await expect(
        page
          .getByTestId("workspace-header-title-group")
          .getByRole("heading", { name: /^Subscriptions$|^購読一覧$/i }),
      ).toBeVisible();
      await page.setViewportSize({ width: 390, height: 900 });

      await Promise.all([
        expect(page.getByTestId("sliding-pane-tray")).toHaveCount(0),
        expect(page.locator(appLayoutHiddenPaneSelector)).toHaveCount(0),
      ]);
    });
  });

  test("groups secondary article actions under More actions on mobile", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 639, height: 900 });
    await page.goto("/");

    const articleList = page.getByRole("listbox", {
      name: /Article list|記事一覧/i,
    });
    await articleList.getByRole("option").first().click();

    const moreActionsButton = page.getByRole("button", {
      name: /More actions|その他の操作/i,
    });
    await expect(moreActionsButton).toBeVisible();

    await moreActionsButton.click();

    await expectLocatorsVisibleInParallel([
      page.getByRole("menuitem", { name: /Copy link|リンクをコピー/i }),
      page.getByRole("menuitem", {
        name: /Open in External Browser|外部ブラウザで開く/i,
      }),
    ]);
  });

  test("opens subscription review from the subscriptions index and shows split review controls", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await openSubscriptionReview(page);

    await Promise.all([
      expect(
        page.getByRole("heading", { name: subscriptionsReviewHeadingName }),
      ).toBeVisible(),
      expect(
        page.getByRole("button", { name: subscriptionsReviewFilterButtonName }),
      ).toHaveAttribute("aria-pressed", "true"),
      expect(page.getByTestId("subscriptions-detail-pane")).toBeVisible(),
    ]);
  });

  test("keeps subscription detail actions below the inventory heading on narrow screens", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await openSubscriptionInventory(page);
    await page.setViewportSize({ width: 639, height: 900 });

    const detailActions = page
      .locator(
        '[data-testid="subscriptions-detail-decision-bar"], [data-testid="subscriptions-detail-management-bar"]',
      )
      .first();
    const inventoryHeading = page.getByRole("heading", {
      name: subscriptionsInventoryHeadingName,
    });

    await Promise.all([
      expect(detailActions).toBeVisible(),
      expect(inventoryHeading).toBeVisible(),
    ]);

    const [actionBox, headingBox] = await Promise.all([
      expectMeasurableBox(detailActions, "subscription detail controls"),
      expectMeasurableBox(inventoryHeading, "subscription inventory heading"),
    ]);

    expect(actionBox.y).toBeGreaterThan(headingBox.y);
  });

  test("keeps the first subscription row fixed when selection state changes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await openSubscriptionInventory(page);
    await expect(
      page.getByRole("heading", { name: subscriptionsInventoryHeadingName }),
    ).toBeVisible();

    const rows = subscriptionRows(page);
    const firstRow = rows.first();

    // The before/after measurements depend on the click in between, so this timing-sensitive flow stays sequential.
    const rowBefore = await expectMeasurableBox(firstRow, "subscription row");
    await firstRow.click();
    const rowAfter = await expectMeasurableBox(firstRow, "subscription row");

    expect(rowAfter.y).toBe(rowBefore.y);
  });

  test("keeps the first subscription row fixed on narrow screens when selection state changes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await openSubscriptionInventory(page);
    await page.setViewportSize({ width: 639, height: 900 });

    const rows = subscriptionRows(page);
    const firstRow = rows.first();

    // The before/after measurements depend on the click in between, so this timing-sensitive flow stays sequential.
    const rowBefore = await expectMeasurableBox(firstRow, "subscription row");
    await firstRow.click();
    const rowAfter = await expectMeasurableBox(firstRow, "subscription row");

    expect(rowAfter.y).toBe(rowBefore.y);
  });

  test("aligns the subscription rail and rows to the same right content edge", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/");

    await openSubscriptionInventory(page);
    await expect(
      page.getByRole("heading", { name: subscriptionsInventoryHeadingName }),
    ).toBeVisible();

    const subscriptionRail = page
      .locator('[data-testid^="subscriptions-folder-tree-rail-"]')
      .first();
    const firstRow = subscriptionRows(page).first();

    const [railBox, rowBox] = await Promise.all([
      expectMeasurableBox(subscriptionRail, "subscription rail"),
      expectMeasurableBox(firstRow, "subscription row"),
    ]);

    expect(
      Math.abs(railBox.x + railBox.width - (rowBox.x + rowBox.width)),
    ).toBeLessThanOrEqual(1);
  });
});
