import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createSampleAccounts } from "@tests/helpers/api-fixtures";
import { createQueryWrapper, createWrapper } from "@tests/helpers/create-wrapper";
import { createDeferred } from "@tests/helpers/deferred";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { FeedDto, LocalFeedSyncStatusDto } from "@/api/tauri-commands";
import { SubscriptionsIndexPage } from "@/components/subscriptions-index/subscriptions-index-page";
import type { SubscriptionsIndexPageView } from "@/components/subscriptions-index/subscriptions-index-page-view";
import { __resetFeedRetryStateForTests } from "@/hooks/use-local-feed-sync-statuses";
import i18n from "@/lib/i18n";
import { queryKeys } from "@/lib/query/query-invalidation";
import type { SubscriptionActionRail } from "@/lib/subscriptions/subscriptions-index";
import type {
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionFilterOption,
  SubscriptionListGroup,
  SubscriptionListRow,
} from "@/lib/subscriptions/subscriptions-index.types";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useSubscriptionReviewStore } from "@/stores/subscription-review-store";
import { useUiStore } from "@/stores/ui-store";

function getRequiredHTMLElement(element: Element | null, description: string) {
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Expected ${description} to be an HTML element`);
  }
  return element;
}

let deleteFeedHandler: (() => unknown) | null = null;
let deleteFeedCalls: string[] = [];
let feedRows: FeedDto[] = [];
let documentVisibilityState = "visible";

function setDocumentVisibilityState(visibilityState: DocumentVisibilityState) {
  documentVisibilityState = visibilityState;
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => documentVisibilityState,
  });
}

describe("SubscriptionsIndexPage", () => {
  beforeEach(async () => {
    vi.useRealTimers();
    await i18n.changeLanguage("ja");
    useSubscriptionReviewStore.setState({ kept: new Map() });
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      subscriptionsWorkspace: { kind: "index", accountId: "acc-1" },
    });
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    deleteFeedHandler = null;
    deleteFeedCalls = [];
    __resetFeedRetryStateForTests();
    setDocumentVisibilityState("visible");
    feedRows = [
      {
        id: "feed-1",
        account_id: "acc-1",
        folder_id: "folder-1",
        remote_id: null,
        title: "Example Feed",
        url: "https://example.com/feed.xml",
        site_url: "https://example.com",
        icon_url: null,
        unread_count: 0,
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      },
      {
        id: "feed-2",
        account_id: "acc-1",
        folder_id: "folder-2",
        remote_id: null,
        title: "Fresh Feed",
        url: "https://example.com/fresh.xml",
        site_url: "https://example.com/fresh",
        icon_url: null,
        unread_count: 3,
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      },
      {
        id: "feed-3",
        account_id: "acc-1",
        folder_id: null,
        remote_id: null,
        title: "Loose Feed",
        url: "https://example.com/loose.xml",
        site_url: "https://example.com/loose",
        icon_url: null,
        unread_count: 1,
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      },
    ];

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return feedRows;
        case "list_folders":
          return [
            {
              id: "folder-1",
              account_id: args.accountId,
              name: "Work",
              sort_order: 0,
            },
            {
              id: "folder-2",
              account_id: args.accountId,
              name: "Work",
              sort_order: 1,
            },
          ];
        case "list_account_articles":
          return [
            {
              id: "art-1",
              feed_id: "feed-1",
              title: "Old article",
              content_sanitized: "<p>old</p>",
              summary: null,
              url: "https://example.com/old/1",
              author: null,
              published_at: "2024-01-01T10:00:00Z",
              thumbnail: null,
              is_read: true,
              is_starred: false,
            },
            {
              id: "art-2",
              feed_id: "feed-2",
              title: "Fresh article",
              content_sanitized: "<p>fresh</p>",
              summary: null,
              url: "https://example.com/fresh/1",
              author: null,
              published_at: "2099-04-01T10:00:00Z",
              thumbnail: null,
              is_read: false,
              is_starred: true,
            },
            {
              id: "art-3",
              feed_id: "feed-3",
              title: "Loose article",
              content_sanitized: "<p>loose</p>",
              summary: null,
              url: "https://example.com/loose/1",
              author: null,
              published_at: "2099-03-15T10:00:00Z",
              thumbnail: null,
              is_read: false,
              is_starred: false,
            },
          ];
        case "list_feed_article_summaries":
          return [
            {
              feed_id: "feed-1",
              latest_article_at: "2024-01-01T10:00:00Z",
              last_seen_article_at: null,
              starred_count: 0,
              recent_article_count: 0,
            },
            {
              feed_id: "feed-2",
              latest_article_at: "2099-04-01T10:00:00Z",
              last_seen_article_at: null,
              starred_count: 1,
              recent_article_count: 0,
            },
            {
              feed_id: "feed-3",
              latest_article_at: "2099-03-15T10:00:00Z",
              last_seen_article_at: null,
              starred_count: 0,
              recent_article_count: 0,
            },
          ];
        case "get_feed_integrity_report":
          return {
            orphaned_article_count: 1,
            orphaned_feeds: [
              {
                missing_feed_id: "missing-feed",
                article_count: 1,
                latest_article_title: "Broken article",
                latest_article_published_at: "2026-04-01T10:00:00Z",
              },
            ],
          };
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        case "delete_feed":
          deleteFeedCalls.push(String(args.feedId));
          return deleteFeedHandler ? deleteFeedHandler() : null;
        default:
          return undefined;
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    setDocumentVisibilityState("visible");
  });

  it("renders the filter bar and selects the first feed by default", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "購読一覧" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "戻る" })).toBeNull();
    expect(screen.getByRole("button", { name: "閉じる" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "全購読" })).toBeInTheDocument();
    expect(screen.getByText("総購読数")).toBeInTheDocument();
    expect(screen.getByText("90日以上未更新")).toBeInTheDocument();
    expect(screen.getByText("更新過多")).toBeInTheDocument();
    expect(await screen.findAllByRole("heading", { name: "Work" })).toHaveLength(2);
    expect(document.querySelectorAll('img[src*="google.com/s2/favicons?domain=example.com"]').length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("未読 0件")).toBeInTheDocument();
    expect(screen.getByText(/^[\d,]+日前$/)).toBeInTheDocument();
    expect(screen.getAllByText("今日")).toHaveLength(2);

    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    expect(await within(detailPane).findByRole("heading", { name: "Example Feed" })).toBeInTheDocument();
    expect(detailPane.querySelector(".motion-content-swap")).toHaveAttribute("data-motion-phase", "entering");
    expect(await within(detailPane).findByText(/RSS上で[\d,]+日、新しい記事がありません/)).toBeInTheDocument();
    expect(await within(detailPane).findByTestId("subscriptions-detail-action-rail")).toHaveClass(
      "motion-content-swap",
      "rounded-md",
    );
  });

  it("shows the managed account name as header text without an in-page account switcher", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "購読一覧" })).toBeInTheDocument();
    const headerBody = screen.getByTestId("workspace-header-body");
    expect(await within(headerBody).findByText("Local")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("omits the account name from the header when there is a single account", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") return createSampleAccounts().filter((account) => account.id === "acc-1");
      return undefined;
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "購読一覧" })).toBeInTheDocument();
    const headerBody = screen.getByTestId("workspace-header-body");
    expect(within(headerBody).queryByText("Local")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("puts the fetch error filter after the fixed filters once a feed has a recorded error", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_feeds") return feedRows;
      if (cmd === "get_local_feed_sync_statuses") {
        return [
          {
            feed_id: "feed-1",
            last_attempt_at: "2026-10-10T12:00:00Z",
            last_success_at: null,
            error_kind: "network",
            error_count: 1,
            diagnostic_id: "b52e8e15-b8c0-46d3-9949-44a6e5aab0b1",
          },
        ];
      }
      return undefined;
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const group = await screen.findByRole("group", { name: "購読の絞り込み" });
    expect(await within(group).findByRole("button", { name: "取得エラー1" })).toHaveAttribute("aria-pressed", "false");
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.textContent?.replace(/\d+$/, "")),
    ).toEqual(["総購読数", "90日以上未更新", "更新過多", "取得エラー"]);
  });

  it("replaces the empty state with a retryable load error when the feed list fails", async () => {
    const user = userEvent.setup();
    let feedReads = 0;
    setupTauriMocks((cmd) => {
      if (cmd === "list_feeds") {
        feedReads += 1;
        if (feedReads === 1) throw new Error("feed list unavailable");
        return feedRows;
      }
      return undefined;
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const banner = await screen.findByTestId("subscriptions-list-load-error");
    expect(banner).toHaveAttribute("role", "alert");
    expect(screen.queryByText("一致する購読はありません。")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();

    await user.click(within(banner).getByRole("button", { name: "再試行" }));

    expect(await screen.findByRole("button", { name: /Example Feed/ })).toBeInTheDocument();
    expect(screen.queryByTestId("subscriptions-list-load-error")).not.toBeInTheDocument();
    expect(feedReads).toBe(2);
  });

  it("shows a loading region instead of the empty state or zero counts while the lists load", async () => {
    const feeds = createDeferred<FeedDto[]>();
    setupTauriMocks((cmd) => {
      if (cmd === "list_feeds") return feeds.promise;
      return undefined;
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByTestId("subscriptions-list-skeleton")).toHaveTextContent("購読を読み込み中");
    expect(screen.queryByText("一致する購読はありません。")).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "まとめて選択" })).toBeDisabled();

    await act(async () => {
      feeds.resolve(feedRows);
    });

    expect(await screen.findByRole("button", { name: /Example Feed/ })).toBeInTheDocument();
    expect(screen.queryByTestId("subscriptions-list-skeleton")).not.toBeInTheDocument();
  });

  it("hides summary-derived counts and retries once when the summaries fail", async () => {
    const user = userEvent.setup();
    let summaryReads = 0;
    setupTauriMocks((cmd) => {
      if (cmd === "list_feeds") return feedRows;
      if (cmd === "list_feed_article_summaries") {
        summaryReads += 1;
        if (summaryReads === 1) throw new Error("summaries unavailable");
        return [];
      }
      return undefined;
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const banner = await screen.findByTestId("subscriptions-summary-load-error");
    expect(banner).toHaveAttribute("role", "alert");
    const group = screen.getByRole("group", { name: "購読の絞り込み" });
    expect(await within(group).findByRole("button", { name: "総購読数3" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "90日以上未更新" })).toBeInTheDocument();
    expect(within(group).getByRole("button", { name: "更新過多" })).toBeInTheDocument();

    await user.click(within(banner).getByRole("button", { name: "再試行" }));

    await waitFor(() => expect(screen.queryByTestId("subscriptions-summary-load-error")).not.toBeInTheDocument());
    expect(within(group).getByRole("button", { name: /^90日以上未更新\d+$/ })).toBeInTheDocument();
    expect(summaryReads).toBe(2);
  });

  it("keeps an incomplete retry result in the fetch error card instead of a toast", async () => {
    const user = userEvent.setup();
    setupTauriMocks((cmd) => {
      if (cmd === "list_feeds") return feedRows;
      if (cmd === "get_local_feed_sync_statuses") {
        return [
          {
            feed_id: "feed-1",
            last_attempt_at: "2026-04-04T12:00:00Z",
            last_success_at: null,
            error_kind: "network",
            error_count: 1,
            diagnostic_id: "b52e8e15-b8c0-46d3-9949-44a6e5aab0b1",
          },
        ];
      }
      if (cmd === "trigger_sync_feed") {
        return {
          synced: true,
          total: 1,
          succeeded: 0,
          failed: [{ account_id: "acc-1", account_name: "Local", message: "Fetch failed" }],
          warnings: [],
        };
      }
      return undefined;
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "再取得" }));

    const outcome = await screen.findByTestId("subscriptions-fetch-error-retry-outcome");
    expect(outcome).toHaveTextContent("再取得が完了しませんでした。結果を確認してください。");
    expect(outcome).toHaveAttribute("role", "alert");
    expect(screen.getByTestId("subscriptions-fetch-error-detail")).toContainElement(outcome);
    expect(screen.queryByTestId("test-toast-host")).not.toBeInTheDocument();
  });

  it("announces a successful retry in the fetch error card until the statuses refresh", async () => {
    const user = userEvent.setup();
    const refreshedStatuses = createDeferred<LocalFeedSyncStatusDto[]>();
    let statusReads = 0;
    setupTauriMocks((cmd) => {
      if (cmd === "list_feeds") return feedRows;
      if (cmd === "get_local_feed_sync_statuses") {
        statusReads += 1;
        if (statusReads > 1) return refreshedStatuses.promise;
        return [
          {
            feed_id: "feed-1",
            last_attempt_at: "2026-04-04T12:00:00Z",
            last_success_at: null,
            error_kind: "network",
            error_count: 1,
            diagnostic_id: null,
          },
        ];
      }
      if (cmd === "trigger_sync_feed") return { synced: true, total: 1, succeeded: 1, failed: [], warnings: [] };
      return undefined;
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "再取得" }));

    const outcome = await screen.findByTestId("subscriptions-fetch-error-retry-outcome");
    expect(outcome).toHaveTextContent("再取得しました");
    expect(outcome).toHaveAttribute("role", "status");
    // The card goes away once the statuses refresh, so success is also announced as a toast.
    expect(await screen.findByTestId("test-toast-host")).toHaveTextContent("再取得しました");

    await act(async () => {
      refreshedStatuses.resolve([]);
    });
    await waitFor(() => expect(screen.queryByTestId("subscriptions-fetch-error-detail")).not.toBeInTheDocument());
    expect(screen.queryByTestId("subscriptions-fetch-error-retry-outcome")).not.toBeInTheDocument();
  });

  it("keeps the diagnostic copy failure on screen until it is dismissed", async () => {
    const user = userEvent.setup();
    setupTauriMocks((cmd) => {
      if (cmd === "list_feeds") return feedRows;
      if (cmd === "copy_to_clipboard") throw new Error("clipboard denied");
      if (cmd === "get_local_feed_sync_statuses") {
        return [
          {
            feed_id: "feed-1",
            last_attempt_at: "2026-04-04T12:00:00Z",
            last_success_at: null,
            error_kind: "network",
            error_count: 1,
            diagnostic_id: "b52e8e15-b8c0-46d3-9949-44a6e5aab0b1",
          },
        ];
      }
      return undefined;
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "診断番号をコピー" }));

    await waitFor(() =>
      expect(useUiStore.getState().toastMessage).toMatchObject({
        message: "診断番号をコピーできませんでした",
        severity: "error",
        persistent: true,
      }),
    );
  });

  it("keeps the page view props aligned with the shared subscriptions index models", () => {
    type PageViewProps = ComponentProps<typeof SubscriptionsIndexPageView>;

    expectTypeOf<PageViewProps["filterBar"]["options"][number]>().toEqualTypeOf<SubscriptionFilterOption>();
    expectTypeOf<PageViewProps["groups"][number]>().toEqualTypeOf<SubscriptionListGroup>();
    expectTypeOf<PageViewProps["selectedRow"]>().toEqualTypeOf<SubscriptionListRow | null>();
    expectTypeOf<PageViewProps["selectedMetrics"]>().toEqualTypeOf<SubscriptionDetailMetrics | null>();
    expectTypeOf<PageViewProps["selectedDetailCandidate"]>().toEqualTypeOf<SubscriptionDetailCandidate | null>();
    expectTypeOf<NonNullable<PageViewProps["actionRail"]>>().toEqualTypeOf<SubscriptionActionRail>();
  });

  it("renders lightweight feed rows and only highlights the selected feed", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const selectedFeed = await screen.findByRole("button", {
      name: /Example Feed/,
    });
    const secondaryFeed = screen.getByRole("button", { name: /Fresh Feed/ });
    expect(selectedFeed).toHaveAccessibleName(/Example Feed/);
    expect(selectedFeed).toHaveAccessibleName(/未読 0件/);
    expect(secondaryFeed.querySelector("[data-label-chip]")).toBeNull();
    await waitFor(() => {
      expect(selectedFeed).toHaveAttribute("aria-pressed", "true");
    });
    expect(selectedFeed).toHaveClass("motion-static-hover-surface");
    expect(selectedFeed).toHaveClass("bg-[color:var(--subscriptions-list-row-selected-surface)]");
    expect(selectedFeed).toHaveClass("shadow-[var(--subscriptions-list-row-selected-shadow)]");
    expect(selectedFeed).toHaveClass("focus-visible:ring-2");
    expect(selectedFeed.className).toMatch(/rounded-(md|lg|xl)/);
    const selectedFaviconSurface = getRequiredHTMLElement(
      selectedFeed.querySelector("span.rounded-md"),
      "selected favicon surface",
    );
    expect(selectedFaviconSurface.style.backgroundColor).toBe("var(--subscriptions-list-favicon-surface)");
    expect(selectedFaviconSurface.style.borderColor).toBe("var(--subscriptions-list-divider)");
    expect(selectedFeed.querySelector('img[src*="google.com/s2/favicons?domain=example.com"]')).toHaveClass(
      "h-6",
      "w-6",
    );
    expect(secondaryFeed).toHaveAccessibleName(/Fresh Feed/);
    expect(secondaryFeed).toHaveAccessibleName(/未読 3件/);
    expect(secondaryFeed).toHaveAttribute("aria-pressed", "false");
    expect(secondaryFeed).not.toHaveClass("bg-card/75");
    const secondaryFaviconSurface = getRequiredHTMLElement(
      secondaryFeed.querySelector("span.rounded-md"),
      "secondary favicon surface",
    );
    expect(secondaryFaviconSurface.style.backgroundColor).toBe("var(--subscriptions-list-favicon-surface-muted)");
    expect(secondaryFaviconSurface.style.borderColor).toBe("var(--subscriptions-list-divider)");
    expect(selectedFeed.querySelector('img[src*="google.com/s2/favicons?domain=example.com"]')).toBeTruthy();
  });

  it("places the wrapping filter bar in the list pane instead of workspace navigation", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const group = await screen.findByRole("group", { name: "購読の絞り込み" });
    const listPane = getRequiredHTMLElement(
      screen.getByRole("heading", { name: "全購読" }).closest("section"),
      "list pane",
    );
    expect(listPane).toContainElement(group);
    expect(group).toHaveClass("flex-wrap");
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /見直し候補/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /参照エラー/ })).not.toBeInTheDocument();
  });

  it("keeps the subscriptions workspace shell aligned with the lighter left pane", async () => {
    const { container } = render(<SubscriptionsIndexPage />, {
      wrapper: createWrapper(),
    });

    const shell = await screen.findByTestId("subscriptions-workspace-shell");
    expect(shell).toHaveClass("min-h-0");
    expect(shell).toHaveClass("overflow-visible");
    expect(shell).toHaveClass("rounded-md");
    expect(shell).toHaveClass("lg:overflow-hidden");
    expect(shell).toHaveClass("lg:grid-cols-[minmax(0,1fr)_480px]");
    expect(shell).toHaveClass("border", "border-border/70");
    expect(shell.style.borderColor).toBe("");
    expect(shell.style.backgroundColor).toBe("transparent");
    expect(shell.style.boxShadow).toBe("var(--subscriptions-workspace-shadow)");

    const leftPaneSection = within(shell).getByRole("heading", { name: "全購読" }).closest("section");
    if (!leftPaneSection) {
      throw new Error("left pane section not found");
    }
    expect(leftPaneSection).toHaveClass("rounded-md");

    const leftPaneScrollRegion = leftPaneSection.querySelector('[data-testid="subscriptions-list-scroll-region"]');
    expect(leftPaneScrollRegion).toBeTruthy();
    expect(leftPaneScrollRegion).toHaveClass("lg:min-h-0");
    expect(leftPaneScrollRegion).toHaveClass("lg:flex-1");
    expect(leftPaneScrollRegion).toHaveClass("lg:overflow-y-auto");

    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    expect(detailPane).toHaveClass("rounded-md");

    const detailScrollRegion = detailPane.querySelector(".motion-content-swap");
    expect(detailScrollRegion).toBeTruthy();
    expect(detailScrollRegion).not.toHaveClass("pr-2");

    expect(container.querySelector("[data-browser-overlay-root]")).toBeNull();
  });

  it("exposes folder rows as drop targets in the subscriptions tree", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const firstGroupButton = await screen.findByTestId("subscriptions-folder-row-folder-1");
    const secondGroupButton = screen.getByTestId("subscriptions-folder-row-folder-2");

    expect(firstGroupButton).toHaveAttribute("data-folder-drop-target", "true");
    expect(secondGroupButton).toHaveAttribute("data-folder-drop-target", "true");
    expect(firstGroupButton).toHaveAccessibleName(/Work/);
    expect(secondGroupButton).toHaveAccessibleName(/Work/);
    expect(firstGroupButton).toHaveAttribute("aria-expanded", "true");
    expect(secondGroupButton).toHaveAttribute("aria-expanded", "true");
    expect(within(firstGroupButton).getByText("1")).toHaveClass("text-foreground-soft");
    expect(firstGroupButton).toHaveClass("motion-disclosure-trigger");
    expect(firstGroupButton.className).toMatch(/rounded-(md|lg|xl)/);
    expect(secondGroupButton.className).toMatch(/rounded-(md|lg|xl)/);
    expect(firstGroupButton).toHaveClass("border", "border-transparent");
    expect(screen.getByTestId("subscriptions-folder-rows-folder-1")).toHaveClass("pl-9");
    expect(screen.getByRole("button", { name: /Example Feed/ })).toHaveClass("motion-list-item-enter");
  });

  it("collapses and re-expands a single group while keeping the current detail selection", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const firstGroupButton = await screen.findByTestId("subscriptions-folder-row-folder-1");
    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    const firstGroupPanel = document.getElementById("subscriptions-group-panel-subscription-list:1-folder:folder-1");

    expect(screen.getByRole("button", { name: /Example Feed/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fresh Feed/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Loose Feed/ })).toBeInTheDocument();
    expect(await within(detailPane).findByRole("heading", { name: "Example Feed" })).toBeInTheDocument();
    expect(firstGroupPanel).toHaveAttribute("aria-hidden", "false");
    expect(firstGroupPanel).toHaveClass("motion-disclosure-panel");

    await user.click(firstGroupButton);

    expect(firstGroupButton).toHaveAttribute("aria-expanded", "false");
    expect(firstGroupButton).toHaveClass("text-foreground-soft");
    expect(firstGroupButton).not.toHaveClass("shadow-[var(--subscriptions-list-group-collapsed-shadow)]");
    expect(firstGroupPanel).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button", { name: /Example Feed/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fresh Feed/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Loose Feed/ })).toBeInTheDocument();
    expect(within(detailPane).getByRole("heading", { name: "Example Feed" })).toBeInTheDocument();
    expect(within(firstGroupButton).getByText("1")).toBeInTheDocument();

    await user.click(firstGroupButton);

    expect(firstGroupButton).toHaveAttribute("aria-expanded", "true");
    expect(firstGroupPanel).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("button", { name: /Example Feed/ })).toBeInTheDocument();
  });

  it("shows selected feed details without embedding row-level destructive actions", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /Example Feed/ }));

    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    expect(detailPane).toHaveAttribute(
      "style",
      expect.stringContaining("background-color: var(--subscriptions-detail-surface)"),
    );
    expect(screen.getByRole("region", { name: "購読の詳細" })).toBe(detailPane);
    expect(within(detailPane).getByRole("link", { name: "Example Feed" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(within(detailPane).getByText("Work")).toBeInTheDocument();
    expect(within(detailPane).queryByRole("link", { name: "フィードのURL" })).toBeNull();
    expect(within(detailPane).getByText("記事の表示")).toBeInTheDocument();
    expect(within(detailPane).getByText("既定の表示")).toBeInTheDocument();
    expect(detailPane.querySelector('img[src*="google.com/s2/favicons?domain=example.com"]')).toBeTruthy();
    expect(detailPane.querySelector('img[src*="google.com/s2/favicons?domain=example.com"]')).toHaveClass("h-7", "w-7");
    const articleLink = within(detailPane).getByRole("link", {
      name: "Old article",
    });
    expect(articleLink).toHaveAttribute("href", "https://example.com/old/1");
    expect(articleLink).toHaveClass("cursor-pointer");
    expect(within(detailPane).queryByRole("button", { name: "購読の整理" })).toBeNull();

    const detailScrollRegion = within(detailPane).getByTestId("subscriptions-detail-scroll-region");
    expect(detailScrollRegion).not.toHaveClass("pr-2");
    expect(detailScrollRegion).toHaveClass("lg:min-h-0");
    expect(detailScrollRegion).toHaveClass("lg:flex-1");
    expect(detailScrollRegion).toHaveClass("lg:overflow-y-auto");
  });

  it("filters the list in place from the filter bar and restores all subscriptions", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-31T00:00:00Z"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: /Example Feed/ });
    expect(screen.getByRole("button", { name: /Fresh Feed/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Loose Feed/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "まとめて処理" })).toBeNull();
    expect(screen.queryByRole("button", { name: /参照エラー/ })).toBeNull();

    const group = screen.getByRole("group", { name: "購読の絞り込み" });
    expect(within(group).getByRole("button", { name: "総購読数3" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "90日以上未更新1" })).toHaveAttribute("aria-pressed", "false");

    await user.click(within(group).getByRole("button", { name: "90日以上未更新1" }));

    expect(within(group).getByRole("button", { name: "90日以上未更新1" })).toHaveAttribute("aria-pressed", "true");
    expect(within(group).getByRole("button", { name: "総購読数3" })).toHaveAttribute("aria-pressed", "false");
    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
      accountId: "acc-1",
    });
    expect(screen.getByRole("heading", { name: "90日以上未更新" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fresh Feed/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Example Feed/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Loose Feed/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /総購読数/ }));

    expect(await screen.findByRole("heading", { name: "全購読" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Fresh Feed/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Example Feed/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Loose Feed/ })).toBeInTheDocument();
  });

  it("shows decision actions only for flagged subscriptions", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const detailPane = await screen.findByTestId("subscriptions-detail-pane");
    await user.click(await screen.findByRole("button", { name: /Example Feed/ }));

    const actionRail = await within(detailPane).findByTestId("subscriptions-detail-action-rail");
    expect(actionRail).toBeVisible();
    const keepButton = within(detailPane).getByRole("button", {
      name: /^(見直し対象外にする|decision_keep)$/,
    });
    const deleteButton = within(detailPane).getByRole("button", {
      name: /^(購読解除|unsubscribe_action)$/,
    });
    expect(keepButton).toBeVisible();
    expect(deleteButton).toBeVisible();
    expect(keepButton.querySelector("svg")).toHaveClass("size-4");
    expect(deleteButton.querySelector("svg")).toHaveClass("size-4");

    await user.click(keepButton);
    expect(useUiStore.getState().toastMessage?.message).toMatch(
      /^(Example Feed を見直し対象外にしました|decision_kept)$/,
    );
    await user.click(deleteButton);
    const unsubscribeDialog = await screen.findByRole("dialog");
    expect(unsubscribeDialog).toBeInTheDocument();
    expect(within(unsubscribeDialog).getByText("Example Feed")).toBeInTheDocument();
    await user.click(
      within(unsubscribeDialog).getByRole("button", {
        name: /^(キャンセル|cancel)$/,
      }),
    );

    await user.click(screen.getByRole("button", { name: /Fresh Feed/ }));

    expect(within(detailPane).getByTestId("subscriptions-detail-action-rail")).toBeInTheDocument();
    expect(within(detailPane).queryByRole("button", { name: /^(見直し対象外にする|decision_keep)$/ })).toBeNull();
    await user.click(within(detailPane).getByRole("button", { name: /^(編集|edit)$/ }));
    const editDialog = await screen.findByRole("dialog", {
      name: /^(フィードを編集|edit_feed)$/,
    });
    expect(within(editDialog).getByDisplayValue("Fresh Feed")).toBeInTheDocument();
    await user.click(within(editDialog).getByRole("button", { name: /^(キャンセル|cancel)$/ }));
    expect(within(detailPane).getByRole("button", { name: /^(購読解除|unsubscribe_action)$/ })).toBeInTheDocument();
  });

  it("shows the review exclusion in the list and detail pane and lets the detail pane remove it", async () => {
    const user = userEvent.setup();
    useSubscriptionReviewStore.getState().keep("acc-1", "feed-2");

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    await user.click(await screen.findByRole("button", { name: /Example Feed/ }));
    const actionRail = await within(detailPane).findByTestId("subscriptions-detail-action-rail");
    const keepButton = within(actionRail).getByRole("button", { name: "見直し対象外にする" });
    await user.click(keepButton);

    expect(within(detailPane).getByTestId("subscriptions-detail-action-rail")).toBe(actionRail);
    const unkeepButton = within(actionRail).getByRole("button", { name: "見直し対象外を解除" });
    expect(unkeepButton).toBe(keepButton);
    expect(unkeepButton).toHaveFocus();
    expect(unkeepButton.className).not.toContain("state-success");
    expect(within(actionRail).getByRole("button", { name: "編集" })).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: /Example Feed/ })).getByText("見直し対象外")).toBeInTheDocument();

    useUiStore.getState().clearToast();
    await user.click(unkeepButton);

    expect(within(detailPane).getByTestId("subscriptions-detail-action-rail")).toBe(actionRail);
    expect(within(actionRail).getByRole("button", { name: "見直し対象外にする" })).toBe(keepButton);
    expect(within(actionRail).getByRole("button", { name: "編集" })).toBeInTheDocument();
    expect(keepButton.className).toContain("state-success");
    expect(within(screen.getByRole("button", { name: /Example Feed/ })).queryByText("見直し対象外")).toBeNull();
    expect(useUiStore.getState().toastMessage).toBeNull();

    await user.click(screen.getByRole("button", { name: /Fresh Feed/ }));
    const freshRail = within(detailPane).getByTestId("subscriptions-detail-action-rail");
    expect(within(freshRail).getByRole("button", { name: "見直し対象外を解除" })).toBeInTheDocument();
    const freshEditButton = within(freshRail).getByRole("button", { name: "編集" });

    await user.click(within(freshRail).getByRole("button", { name: "見直し対象外を解除" }));
    expect(within(freshRail).queryByRole("button", { name: "見直し対象外を解除" })).toBeNull();
    expect(within(freshRail).getByRole("button", { name: "編集" })).toBe(freshEditButton);
    expect(freshEditButton).toHaveFocus();
  });

  it("removes kept feeds from the active stale filter and clears the detail pane", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-31T00:00:00Z"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /90日以上未更新/ }));
    expect(await screen.findByRole("button", { name: /Example Feed/ })).toBeInTheDocument();

    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    await user.click(within(detailPane).getByRole("button", { name: "見直し対象外にする" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Example Feed/ })).not.toBeInTheDocument();
    });
    expect(screen.getByText("「90日以上未更新」に一致する購読はありません")).toBeInTheDocument();
    expect(within(detailPane).getByText("購読を選ぶと詳細が表示されます。")).toBeInTheDocument();
  });

  it("hands focus to the repaired row's decision button after a decision removes the selected stale row", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-31T00:00:00Z"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    feedRows = [
      {
        id: "feed-1",
        account_id: "acc-1",
        folder_id: null,
        remote_id: null,
        title: "Stale One",
        url: "https://example.com/stale-one.xml",
        site_url: "https://example.com/stale-one",
        icon_url: null,
        unread_count: 0,
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      },
      {
        id: "feed-3",
        account_id: "acc-1",
        folder_id: null,
        remote_id: null,
        title: "Stale Two",
        url: "https://example.com/stale-two.xml",
        site_url: "https://example.com/stale-two",
        icon_url: null,
        unread_count: 0,
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      },
    ];
    setupTauriMocks((cmd) => {
      if (cmd === "list_feeds") return feedRows;
      if (cmd === "list_folders") return [];
      if (cmd === "list_account_articles") {
        return [
          {
            id: "art-1",
            feed_id: "feed-1",
            title: "Old article one",
            content_sanitized: "<p>old</p>",
            summary: null,
            url: "https://example.com/stale-one/1",
            author: null,
            published_at: "2024-01-01T10:00:00Z",
            thumbnail: null,
            is_read: true,
            is_starred: false,
          },
          {
            id: "art-3",
            feed_id: "feed-3",
            title: "Old article two",
            content_sanitized: "<p>old</p>",
            summary: null,
            url: "https://example.com/stale-two/1",
            author: null,
            published_at: "2024-06-01T10:00:00Z",
            thumbnail: null,
            is_read: true,
            is_starred: false,
          },
        ];
      }
      if (cmd === "list_feed_article_summaries") {
        return [
          {
            feed_id: "feed-1",
            latest_article_at: "2024-01-01T10:00:00Z",
            last_seen_article_at: null,
            starred_count: 0,
            recent_article_count: 0,
          },
          {
            feed_id: "feed-3",
            latest_article_at: "2024-06-01T10:00:00Z",
            last_seen_article_at: null,
            starred_count: 0,
            recent_article_count: 0,
          },
        ];
      }
      return undefined;
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /90日以上未更新/ }));

    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    expect(await within(detailPane).findByText("Stale One")).toBeInTheDocument();
    const keepButton = within(detailPane).getByRole("button", { name: "見直し対象外にする" });
    keepButton.focus();
    expect(keepButton).toHaveFocus();

    await user.click(keepButton);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Stale One/ })).not.toBeInTheDocument();
    });
    expect(within(detailPane).getByText("Stale Two")).toBeInTheDocument();
    expect(within(detailPane).getByRole("button", { name: "見直し対象外にする" })).toHaveFocus();
  });

  it("shows scoped no-error copy after retry clears the last failure while its filter stays active", async () => {
    const user = userEvent.setup();
    let statusReads = 0;
    setupTauriMocks((cmd) => {
      if (cmd === "list_feeds") return feedRows;
      if (cmd === "get_local_feed_sync_statuses") {
        statusReads += 1;
        return feedRows.map((feed, index) => ({
          feed_id: feed.id,
          last_attempt_at: index === 0 ? "2026-04-04T12:00:00Z" : null,
          last_success_at: null,
          error_kind: statusReads === 1 && index === 0 ? "network" : null,
          error_count: statusReads === 1 && index === 0 ? 1 : 0,
          diagnostic_id: statusReads === 1 && index === 0 ? "b52e8e15-b8c0-46d3-9949-44a6e5aab0b1" : null,
        }));
      }
      if (cmd === "trigger_sync_feed") {
        return { synced: true, total: 1, succeeded: 1, failed: [], warnings: [] };
      }
      return undefined;
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /^取得エラー/ }));
    expect(await screen.findByRole("button", { name: /Example Feed/ })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "再取得" }));

    expect(await screen.findByText("取得エラーのある購読はありません")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "取得エラー0" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /^総購読数/ }));

    expect(screen.queryByRole("button", { name: /^取得エラー/ })).not.toBeInTheDocument();
  });

  it("restores a returned stale filter, collapsed group state, and list scroll position", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-31T00:00:00Z"));
    const availableFeeds = feedRows;
    feedRows = [];
    const { queryClient, wrapper } = createQueryWrapper();
    useUiStore.setState({
      ...useUiStore.getState(),
      subscriptionsWorkspace: {
        kind: "index",
        accountId: "acc-1",
        returnState: {
          accountId: "acc-1",
          activeSummaryFilter: "stale",
          selectedFeedId: "feed-1",
          expandedGroups: {
            "group:subscription-list:1-folder:folder-1": false,
            "group:subscription-list:1-folder:folder-2": true,
            "group:subscription-list:0-sentinel:no-folder": true,
          },
          listScrollTop: {
            scrollTop: 18,
            layoutGeneration: "feed-1",
            viewportHeight: window.innerHeight,
          },
        },
      },
    });

    render(<SubscriptionsIndexPage />, { wrapper });

    expect(await screen.findByText("「90日以上未更新」に一致する購読はありません")).toBeInTheDocument();
    feedRows = availableFeeds;
    await queryClient.invalidateQueries({ queryKey: queryKeys.feeds.byAccount("acc-1") });

    const firstGroupButton = await screen.findByTestId("subscriptions-folder-row-folder-1");
    const firstGroupPanel = document.getElementById("subscriptions-group-panel-subscription-list:1-folder:folder-1");
    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    const workspaceShell = screen.getByTestId("subscriptions-workspace-shell");
    const listPane = workspaceShell.querySelector("section");
    const listScrollRegion = listPane?.querySelector('[data-testid="subscriptions-list-scroll-region"]');

    expect(firstGroupButton).toHaveAttribute("aria-expanded", "false");
    expect(firstGroupPanel).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button", { name: /Example Feed/ })).not.toBeInTheDocument();
    expect(within(detailPane).getByRole("heading", { name: "Example Feed" })).toBeInTheDocument();
    expect(listScrollRegion).toHaveProperty("scrollTop", 18);
  });

  it("lands on the requested feed from a feed navigation request", async () => {
    useUiStore.setState({
      ...useUiStore.getState(),
      subscriptionsWorkspace: {
        kind: "index",
        accountId: "acc-1",
        returnState: {
          accountId: "acc-1",
          activeSummaryFilter: "all",
          selectedFeedId: "feed-1",
          expandedGroups: {
            "group:subscription-list:1-folder:folder-2": false,
          },
          listScrollTop: {
            scrollTop: 0,
            layoutGeneration: "feed-1\nfeed-2\nfeed-3",
            viewportHeight: window.innerHeight,
          },
          searchQuery: "",
        },
        navigationRequest: { accountId: "acc-1", summaryFilter: "all", feedId: "feed-2" },
      },
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    expect(await within(detailPane).findByRole("heading", { name: "Fresh Feed" })).toBeInTheDocument();
    expect(await screen.findByTestId("subscriptions-folder-row-folder-2")).toHaveAttribute("aria-expanded", "true");
    expect(useUiStore.getState().subscriptionsWorkspace?.navigationRequest).toBeUndefined();
  });

  it("drops the restored list scroll when the window is resized after mount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-31T00:00:00Z"));
    const originalInnerHeight = window.innerHeight;
    useUiStore.setState({
      ...useUiStore.getState(),
      subscriptionsWorkspace: {
        kind: "index",
        accountId: "acc-1",
        returnState: {
          accountId: "acc-1",
          activeSummaryFilter: "stale",
          selectedFeedId: "feed-1",
          expandedGroups: {
            "group:subscription-list:1-folder:folder-1": false,
            "group:subscription-list:1-folder:folder-2": true,
            "group:subscription-list:0-sentinel:no-folder": true,
          },
          listScrollTop: {
            scrollTop: 18,
            layoutGeneration: "feed-1",
            viewportHeight: window.innerHeight,
          },
        },
      },
    });

    try {
      render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

      await screen.findByTestId("subscriptions-folder-row-folder-1");
      const listScrollRegion = document.querySelector('[data-testid="subscriptions-list-scroll-region"]');
      expect(listScrollRegion).toHaveProperty("scrollTop", 18);

      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight + 200,
      });
      act(() => {
        window.dispatchEvent(new Event("resize"));
      });

      await waitFor(() => {
        expect(listScrollRegion).toHaveProperty("scrollTop", 0);
      });
    } finally {
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it("adopts a viewport change that lands while the resize listener is being attached", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-31T00:00:00Z"));
    const originalInnerHeight = window.innerHeight;
    useUiStore.setState({
      ...useUiStore.getState(),
      subscriptionsWorkspace: {
        kind: "index",
        accountId: "acc-1",
        returnState: {
          accountId: "acc-1",
          activeSummaryFilter: "stale",
          selectedFeedId: "feed-1",
          expandedGroups: {
            "group:subscription-list:1-folder:folder-1": false,
            "group:subscription-list:1-folder:folder-2": true,
            "group:subscription-list:0-sentinel:no-folder": true,
          },
          listScrollTop: {
            scrollTop: 18,
            layoutGeneration: "feed-1",
            viewportHeight: originalInnerHeight,
          },
        },
      },
    });
    const addEventListener = vi.spyOn(window, "addEventListener").mockImplementation((type) => {
      if (type === "resize") {
        Object.defineProperty(window, "innerHeight", {
          configurable: true,
          value: originalInnerHeight + 200,
        });
      }
    });

    try {
      render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

      await screen.findByTestId("subscriptions-folder-row-folder-1");
      const listScrollRegion = document.querySelector('[data-testid="subscriptions-list-scroll-region"]');

      await waitFor(() => {
        expect(listScrollRegion).toHaveProperty("scrollTop", 0);
      });
    } finally {
      addEventListener.mockRestore();
      Object.defineProperty(window, "innerHeight", {
        configurable: true,
        value: originalInnerHeight,
      });
    }
  });

  it("hides feeds already marked to keep when restoring the stale filter", async () => {
    useUiStore.setState({
      ...useUiStore.getState(),
      subscriptionsWorkspace: {
        kind: "index",
        accountId: "acc-1",
        returnState: {
          accountId: "acc-1",
          activeSummaryFilter: "stale",
          selectedFeedId: "feed-1",
          expandedGroups: {
            "group:subscription-list:1-folder:folder-1": true,
            "group:subscription-list:1-folder:folder-2": true,
            "group:subscription-list:0-sentinel:no-folder": true,
          },
          listScrollTop: {
            scrollTop: 0,
            layoutGeneration: "",
            viewportHeight: window.innerHeight,
          },
        },
      },
    });
    useSubscriptionReviewStore.getState().keep("acc-1", "feed-1");

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("「90日以上未更新」に一致する購読はありません")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Example Feed/ })).not.toBeInTheDocument();
    expect(screen.getByText("購読を選ぶと詳細が表示されます。")).toBeInTheDocument();
  });

  it("ignores a return state from a different account", async () => {
    useUiStore.setState({
      ...useUiStore.getState(),
      subscriptionsWorkspace: {
        kind: "index",
        accountId: "acc-1",
        returnState: {
          accountId: "acc-2",
          activeSummaryFilter: "stale",
          selectedFeedId: "feed-1",
          expandedGroups: {},
          listScrollTop: {
            scrollTop: 24,
            layoutGeneration: "feed-1",
            viewportHeight: window.innerHeight,
          },
        },
      },
    });
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "全購読" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Example Feed/ })).toBeInTheDocument();
    const workspaceShell = screen.getByTestId("subscriptions-workspace-shell");
    const listPane = workspaceShell.querySelector("section");
    const listScrollRegion = listPane?.querySelector('[data-testid="subscriptions-list-scroll-region"]');
    expect(listScrollRegion).toHaveProperty("scrollTop", 0);
  });

  it("refreshes review candidate dates while the page stays mounted", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-31T00:00:00Z"));
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return [
            {
              id: "feed-boundary",
              account_id: "acc-1",
              folder_id: null,
              remote_id: null,
              title: "Boundary Feed",
              url: "https://example.com/boundary.xml",
              site_url: "https://example.com/boundary",
              icon_url: null,
              unread_count: 1,
              reader_mode: "inherit",
              web_preview_mode: "inherit",
            },
          ];
        case "list_folders":
          return [];
        case "list_account_articles":
          return [];
        case "list_feed_article_summaries":
          return [
            {
              feed_id: "feed-boundary",
              latest_article_at: "2026-01-01T00:00:00Z",
              last_seen_article_at: null,
              starred_count: 1,
              recent_article_count: 0,
            },
          ];
        case "get_feed_integrity_report":
          return { orphaned_article_count: 0, orphaned_feeds: [] };
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        case "delete_feed":
          deleteFeedCalls.push(String(args.feedId));
          return null;
        default:
          return undefined;
      }
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /90日以上未更新/ }));
    expect(await screen.findByText("「90日以上未更新」に一致する購読はありません")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

    expect(await screen.findByRole("button", { name: /Boundary Feed/ })).toBeInTheDocument();
  });

  it("refreshes stale review labels on visibility return and cleans up the review clock", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-31T00:00:00Z"));
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return [
            {
              id: "feed-boundary",
              account_id: "acc-1",
              folder_id: null,
              remote_id: null,
              title: "Boundary Feed",
              url: "https://example.com/boundary.xml",
              site_url: "https://example.com/boundary",
              icon_url: null,
              unread_count: 1,
              reader_mode: "inherit",
              web_preview_mode: "inherit",
            },
          ];
        case "list_folders":
          return [];
        case "list_account_articles":
          return [];
        case "list_feed_article_summaries":
          return [
            {
              feed_id: "feed-boundary",
              latest_article_at: "2026-01-01T00:00:00Z",
              last_seen_article_at: null,
              starred_count: 1,
              recent_article_count: 0,
            },
          ];
        case "get_feed_integrity_report":
          return { orphaned_article_count: 0, orphaned_feeds: [] };
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        case "delete_feed":
          deleteFeedCalls.push(String(args.feedId));
          return null;
        default:
          return undefined;
      }
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    const { unmount } = render(<SubscriptionsIndexPage />, {
      wrapper: createWrapper(),
    });

    await user.click(await screen.findByRole("button", { name: /90日以上未更新/ }));
    expect(await screen.findByText("「90日以上未更新」に一致する購読はありません")).toBeInTheDocument();

    vi.setSystemTime(new Date("2026-04-01T00:00:00Z"));
    setDocumentVisibilityState("hidden");
    fireEvent(document, new Event("visibilitychange"));
    expect(screen.queryByRole("button", { name: /Boundary Feed/ })).not.toBeInTheDocument();

    setDocumentVisibilityState("visible");
    fireEvent(document, new Event("visibilitychange"));
    expect(await screen.findByRole("button", { name: /Boundary Feed/ })).toBeInTheDocument();

    const clearIntervalCallCountBeforeUnmount = clearIntervalSpy.mock.calls.length;
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(clearIntervalCallCountBeforeUnmount + 1);
    expect(removeEventListenerSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    clearIntervalSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it("keeps the empty detail surface on the rounded-md baseline", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const emptyDetail = await screen.findByText("購読を選ぶと詳細が表示されます。");
    expect(emptyDetail.className).toMatch(/rounded-(md|lg|xl)/);
    expect(emptyDetail).toHaveClass("bg-[var(--workspace-low-wire-group-surface)]");
    expect(emptyDetail).toHaveClass("text-foreground-soft");
  });

  it("renders the empty detail surface with the rounded-md baseline when no feeds exist", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return [];
        case "list_folders":
          return [
            {
              id: "folder-1",
              account_id: args.accountId,
              name: "Work",
              sort_order: 0,
            },
            {
              id: "folder-2",
              account_id: args.accountId,
              name: "Work",
              sort_order: 1,
            },
          ];
        case "list_account_articles":
          return [];
        case "list_feed_article_summaries":
          return [];
        case "get_feed_integrity_report":
          return {
            orphaned_article_count: 0,
            orphaned_feeds: [],
          };
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const detailPane = await screen.findByTestId("subscriptions-detail-pane");
    const emptySurface = within(detailPane).getByText("購読を選ぶと詳細が表示されます。");

    expect(emptySurface.className).toMatch(/rounded-(md|lg|xl)/);
    expect(emptySurface).toHaveClass("border-dashed");
    expect(emptySurface).toHaveClass("bg-[var(--workspace-low-wire-group-surface)]");
    expect(emptySurface).toHaveClass("text-foreground-soft");
  });

  it("renders the empty subscription list with supportive copy tone when no feeds exist", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return [];
        case "list_folders":
          return [
            {
              id: "folder-1",
              account_id: args.accountId,
              name: "Work",
              sort_order: 0,
            },
            {
              id: "folder-2",
              account_id: args.accountId,
              name: "Work",
              sort_order: 1,
            },
          ];
        case "list_account_articles":
          return [];
        case "list_feed_article_summaries":
          return [];
        case "get_feed_integrity_report":
          return {
            orphaned_article_count: 0,
            orphaned_feeds: [],
          };
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const inventoryHeading = await screen.findByRole("heading", {
      name: "全購読",
    });
    const listPane = inventoryHeading.closest("section");

    if (!listPane) {
      throw new Error("subscriptions list pane not found");
    }

    expect(await within(listPane).findByText("一致する購読はありません。")).toHaveClass("text-foreground-soft");
  });

  it("does not render the removed integrity-error entry", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: /総購読数/ });

    expect(screen.queryByRole("button", { name: /参照エラー/ })).toBeNull();
    expect(screen.queryByText("参照エラーは一覧対象外です。まとめて処理から確認できます。")).toBeNull();
  });

  it("restores the subscriptions workspace after closing and reopening from the header", async () => {
    const { unmount } = render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });
    await screen.findByRole("button", { name: /Example Feed/ });
    const scrollRegion = screen.getByTestId("subscriptions-list-scroll-region");
    scrollRegion.scrollTop = 73;

    fireEvent.click(screen.getByRole("button", { name: "閉じる" }));

    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
    unmount();
    act(() => useUiStore.getState().openSubscriptionsIndex());
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });
    const reopenedScrollRegion = await screen.findByTestId("subscriptions-list-scroll-region");
    await waitFor(() => expect(reopenedScrollRegion.scrollTop).toBe(73));
  });

  it("keeps the filter, search, selection, and collapsed group across a layout-mode rebuild", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: /Example Feed/ });
    const filterGroup = screen.getByRole("group", { name: "購読の絞り込み" });
    await user.click(within(filterGroup).getByRole("button", { name: "90日以上未更新1" }));
    await user.type(screen.getByRole("searchbox"), "Example");
    const groupButton = screen.getByTestId("subscriptions-folder-row-folder-1");
    await user.click(groupButton);
    expect(groupButton).toHaveAttribute("aria-expanded", "false");

    act(() => useUiStore.getState().setLayoutMode("compact"));

    expect(useUiStore.getState().subscriptionsWorkspace?.returnState).toMatchObject({
      accountId: "acc-1",
      activeSummaryFilter: "stale",
      searchQuery: "Example",
      selectedFeedId: "feed-1",
      expandedGroups: { "group:subscription-list:1-folder:folder-1": false },
    });

    unmount();
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("searchbox")).toHaveValue("Example");
    const rebuiltFilterGroup = screen.getByRole("group", { name: "購読の絞り込み" });
    expect(await within(rebuiltFilterGroup).findByRole("button", { name: "90日以上未更新1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await screen.findByTestId("subscriptions-folder-row-folder-1")).toHaveAttribute("aria-expanded", "false");
    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    expect(await within(detailPane).findByRole("heading", { name: "Example Feed" })).toBeInTheDocument();
  });

  it("opens a fresh subscriptions list for a different account", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.type(await screen.findByRole("searchbox"), "Example");
    await user.click(screen.getByRole("button", { name: "閉じる" }));
    unmount();

    act(() => {
      useUiStore.getState().selectAccount("acc-2");
      useUiStore.getState().openSubscriptionsIndex();
    });
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("searchbox")).toHaveValue("");
  });

  it("closes with Escape during overscroll and returns focus to the reader pane", async () => {
    const user = userEvent.setup();

    useUiStore.setState({
      ...useUiStore.getState(),
      selectedArticleId: "art-2",
      contentMode: "reader",
      focusedPane: "content",
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });
    await screen.findByRole("button", { name: /Example Feed/ });
    screen.getByTestId("subscriptions-list-scroll-region").scrollTop = -12;

    await user.keyboard("{Escape}");

    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().focusedPane).toBe("content");
    expect(useUiStore.getState().subscriptionsIndexReturnStates.get("acc-1")).toMatchObject({
      accountId: "acc-1",
      listScrollTop: { scrollTop: 0 },
    });
  });

  it("does not close the subscriptions workspace for an IME commit keydown", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await screen.findByRole("heading", { name: "購読一覧" });
    fireEvent.keyDown(window, { key: "Escape", keyCode: 229 });

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
      accountId: "acc-1",
    });
  });

  it("does not close the subscriptions workspace when another modal layer owns Escape", async () => {
    const user = userEvent.setup();

    render(
      <>
        <SubscriptionsIndexPage />
        <div role="dialog" aria-label="Nested modal" />
      </>,
      { wrapper: createWrapper() },
    );

    await screen.findByRole("dialog", { name: "Nested modal" });
    await user.keyboard("{Escape}");

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
      accountId: "acc-1",
    });
  });

  it("does not close the subscriptions workspace when Escape closes nested edit and delete dialogs", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /Fresh Feed/ }));
    const detailPane = screen.getByTestId("subscriptions-detail-pane");

    await user.click(within(detailPane).getByRole("button", { name: /^(編集|edit)$/ }));
    expect(
      await screen.findByRole("dialog", {
        name: /^(フィードを編集|edit_feed)$/,
      }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /^(フィードを編集|edit_feed)$/ })).not.toBeInTheDocument();
    });
    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
      accountId: "acc-1",
    });

    await user.click(within(detailPane).getByRole("button", { name: /^(購読解除|unsubscribe_action)$/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
      accountId: "acc-1",
    });
  });

  it("restores a kept feed to the stale filter from the toast's undo action", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-31T00:00:00Z"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /90日以上未更新/ }));
    expect(await screen.findByRole("button", { name: /Example Feed/ })).toBeInTheDocument();
    await user.click(
      within(screen.getByTestId("subscriptions-detail-pane")).getByRole("button", { name: "見直し対象外にする" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Example Feed/ })).not.toBeInTheDocument();
    });

    await user.click(within(screen.getByTestId("test-toast-host")).getByRole("button", { name: "元に戻す" }));

    expect(await screen.findByRole("button", { name: /Example Feed/ })).toBeInTheDocument();
    expect(screen.queryByTestId("test-toast-host")).not.toBeInTheDocument();
  });

  it("reaches kept feeds hidden by the stale filter and resets every kept decision of the account after confirming", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-31T00:00:00Z"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    useSubscriptionReviewStore.setState({ kept: new Map([["acc-1", new Set(["feed-1", "feed-3"])]]) });
    const keptFeedIds = () => [...(useSubscriptionReviewStore.getState().kept.get("acc-1") ?? [])].sort();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /90日以上未更新/ }));
    const banner = await screen.findByTestId("subscriptions-kept-banner");
    expect(screen.getByText("「90日以上未更新」に一致する購読はありません")).toBeInTheDocument();
    expect(within(banner).getByText("見直し対象外 1件を非表示")).toBeInTheDocument();

    await user.click(within(banner).getByRole("button", { name: "表示する" }));
    expect(await screen.findByRole("button", { name: /Example Feed/ })).toHaveTextContent("見直し対象外");
    expect(within(banner).getByText("見直し対象外 1件を表示中")).toBeInTheDocument();

    await user.click(within(banner).getByRole("button", { name: "すべて取り消す" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Local の見直し対象外2件をすべて取り消します/)).toBeInTheDocument();
    expect(within(dialog).getByText(/検索で表示されていないフィードの判断も含まれます/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "キャンセル" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(keptFeedIds()).toEqual(["feed-1", "feed-3"]);
    expect(screen.getByRole("button", { name: /Example Feed/ })).toHaveTextContent("見直し対象外");

    await user.click(within(banner).getByRole("button", { name: "すべて取り消す" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "すべて取り消す" }));

    await waitFor(() => {
      expect(keptFeedIds()).toEqual([]);
    });
    expect(screen.getByRole("button", { name: /Example Feed/ })).not.toHaveTextContent("見直し対象外");
    expect(screen.queryByTestId("subscriptions-kept-banner")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "90日以上未更新" })).toHaveFocus();
    });
    const toastHost = screen.getByTestId("test-toast-host");
    expect(within(toastHost).getByText("見直し対象外を2件取り消しました")).toBeInTheDocument();

    await user.click(within(toastHost).getByRole("button", { name: "元に戻す" }));

    expect(keptFeedIds()).toEqual(["feed-1", "feed-3"]);
  });

  it("drops an unsubscribed feed from the remembered kept feeds", async () => {
    const user = userEvent.setup();
    deleteFeedHandler = () => {
      feedRows = feedRows.filter((feed) => feed.id !== "feed-1");
      return null;
    };

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /Example Feed/ }));
    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    await user.click(within(detailPane).getByRole("button", { name: "見直し対象外にする" }));
    await user.click(within(detailPane).getByRole("button", { name: /^(購読解除|unsubscribe_action)$/ }));
    const unsubscribeDialog = await screen.findByRole("dialog");
    await user.click(within(unsubscribeDialog).getByRole("button", { name: /^「Example Feed」の購読を解除します/ }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "閉じる" }));

    expect([...(useSubscriptionReviewStore.getState().kept.get("acc-1") ?? [])]).toEqual([]);
  });

  it("shows a failed unsubscribe in the dialog instead of a toast, and clears it when retrying", async () => {
    const user = userEvent.setup();
    deleteFeedHandler = () => Promise.reject(new Error("boom"));

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /Example Feed/ }));
    await user.click(
      within(screen.getByTestId("subscriptions-detail-pane")).getByRole("button", {
        name: /^(購読解除|unsubscribe_action)$/,
      }),
    );
    const unsubscribeDialog = await screen.findByRole("dialog");
    const confirmButton = within(unsubscribeDialog).getByRole("button", {
      name: /^「Example Feed」の購読を解除します/,
    });

    await user.click(confirmButton);

    expect(await within(unsubscribeDialog).findByRole("alert")).toHaveTextContent("購読解除に失敗しました: boom");
    expect(screen.queryByTestId("test-toast-host")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    const retry = createDeferred<null>();
    deleteFeedHandler = () => retry.promise;
    await user.click(confirmButton);

    await waitFor(() => {
      expect(within(unsubscribeDialog).queryByRole("alert")).not.toBeInTheDocument();
    });
    retry.resolve(null);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("test-toast-host")).toHaveTextContent("Example Feed の購読を解除しました");
  });

  it("guards unsubscribe confirmation while the delete mutation is pending", async () => {
    const user = userEvent.setup();
    let resolveDelete: () => void = () => {};
    deleteFeedHandler = () =>
      new Promise<null>((resolve) => {
        resolveDelete = () => resolve(null);
      });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /Example Feed/ }));
    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    await user.click(within(detailPane).getByRole("button", { name: /^(購読解除|unsubscribe_action)$/ }));
    const unsubscribeDialog = await screen.findByRole("dialog");
    const confirmButton = within(unsubscribeDialog).getByRole("button", {
      name: /^(「Example Feed」の購読を解除します。元に戻せません。|Unsubscribe from "Example Feed"\. This cannot be undone\.)$/,
    });

    fireEvent.click(confirmButton);
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(deleteFeedCalls).toEqual(["feed-1"]);
      expect(confirmButton).toBeDisabled();
      expect(
        within(unsubscribeDialog).getByRole("button", {
          name: /^(キャンセル|cancel)$/,
        }),
      ).toBeDisabled();
    });

    resolveDelete();
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("keeps unsubscribe targets when only the reader account changes", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /Example Feed/ }));
    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    await user.click(within(detailPane).getByRole("button", { name: /^(購読解除|unsubscribe_action)$/ }));
    await screen.findByRole("dialog");

    useUiStore.setState({
      ...useUiStore.getState(),
      selectedAccountId: "acc-2",
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(deleteFeedCalls).toEqual([]);
  });

  it("keeps the unsubscribe dialog after a failed delete when only the reader account changes", async () => {
    const user = userEvent.setup();
    let rejectDelete: (error: Error) => void = () => {};
    deleteFeedHandler = () =>
      new Promise<null>((_resolve, reject) => {
        rejectDelete = reject;
      });

    const { wrapper } = createQueryWrapper({ includeToastHost: true });
    render(<SubscriptionsIndexPage />, { wrapper });

    await user.click(await screen.findByRole("button", { name: /Example Feed/ }));
    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    await user.click(within(detailPane).getByRole("button", { name: /^(購読解除|unsubscribe_action)$/ }));
    const unsubscribeDialog = await screen.findByRole("dialog");
    const confirmButton = within(unsubscribeDialog).getByRole("button", {
      name: /^(「Example Feed」の購読を解除します。元に戻せません。|Unsubscribe from "Example Feed"\. This cannot be undone\.)$/,
    });

    fireEvent.click(confirmButton);
    await waitFor(() => {
      expect(deleteFeedCalls).toEqual(["feed-1"]);
    });

    useUiStore.setState({
      ...useUiStore.getState(),
      selectedAccountId: "acc-2",
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await act(async () => {
      rejectDelete(new Error("boom"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  });

  it("disables stale unsubscribe targets after the feed list refetch removes the target", async () => {
    const user = userEvent.setup();
    const { queryClient, wrapper } = createQueryWrapper({
      includeToastHost: true,
    });

    render(<SubscriptionsIndexPage />, { wrapper });

    await user.click(await screen.findByRole("button", { name: /Example Feed/ }));
    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    await user.click(within(detailPane).getByRole("button", { name: /^(購読解除|unsubscribe_action)$/ }));
    await screen.findByRole("dialog");

    feedRows = feedRows.filter((feed) => feed.id !== "feed-1");
    await queryClient.invalidateQueries({ queryKey: queryKeys.feeds.root });

    const staleDialog = await screen.findByRole("dialog");
    expect(
      within(staleDialog).getByText("フィードを再読み込みできません。対象が確認できるまで購読解除は無効です。"),
    ).toBeInTheDocument();
    expect(
      within(staleDialog).getByRole("button", {
        name: "「Example Feed」の購読を解除します。元に戻せません。",
      }),
    ).toBeDisabled();
    expect(deleteFeedCalls).toEqual([]);
  });

  it("recovers a stale unsubscribe target from the dialog retry after the feed list reloads", async () => {
    const user = userEvent.setup();
    const { queryClient, wrapper } = createQueryWrapper({
      includeToastHost: true,
    });

    render(<SubscriptionsIndexPage />, { wrapper });

    await user.click(await screen.findByRole("button", { name: /Example Feed/ }));
    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    await user.click(within(detailPane).getByRole("button", { name: /^(購読解除|unsubscribe_action)$/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("button", { name: "再試行" })).not.toBeInTheDocument();

    const removedFeed = feedRows.find((feed) => feed.id === "feed-1");
    feedRows = feedRows.filter((feed) => feed.id !== "feed-1");
    await queryClient.invalidateQueries({ queryKey: queryKeys.feeds.root });

    const staleDialog = await screen.findByRole("dialog");
    expect(
      within(staleDialog).getByText("フィードを再読み込みできません。対象が確認できるまで購読解除は無効です。"),
    ).toBeInTheDocument();
    const confirmButton = within(staleDialog).getByRole("button", {
      name: "「Example Feed」の購読を解除します。元に戻せません。",
    });
    expect(confirmButton).toBeDisabled();

    feedRows = removedFeed ? [...feedRows, removedFeed] : feedRows;
    await user.click(within(staleDialog).getByRole("button", { name: "再試行" }));

    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
    });
    expect(
      within(staleDialog).queryByText("フィードを再読み込みできません。対象が確認できるまで購読解除は無効です。"),
    ).not.toBeInTheDocument();
    expect(within(staleDialog).queryByRole("button", { name: "再試行" })).not.toBeInTheDocument();
    expect(deleteFeedCalls).toEqual([]);
  });

  it("opens the add feed dialog from the list header", async () => {
    const user = userEvent.setup();
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "フィードを追加" }));

    expect(useUiStore.getState().isAddFeedDialogOpen).toBe(true);
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("フィード")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "キャンセル" }));

    await waitFor(() => {
      expect(useUiStore.getState().isAddFeedDialogOpen).toBe(false);
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("opens the add feed dialog from the empty state when the account has no subscriptions", async () => {
    const user = userEvent.setup();
    feedRows = [];
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("一致する購読はありません。")).toBeInTheDocument();
    const addButtons = screen.getAllByRole("button", { name: "フィードを追加" });
    expect(addButtons).toHaveLength(2);

    await user.click(addButtons[1]);

    expect(useUiStore.getState().isAddFeedDialogOpen).toBe(true);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("hides the add feed actions when no account is available", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") return [];
      return undefined;
    });
    useUiStore.setState({
      selectedAccountId: null,
      subscriptionsWorkspace: { kind: "index", accountId: null },
    });
    feedRows = [];
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "購読一覧" })).toBeInTheDocument();
    expect(await screen.findByText("一致する購読はありません。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "フィードを追加" })).not.toBeInTheDocument();
    expect(useUiStore.getState().isAddFeedDialogOpen).toBe(false);
  });
});
