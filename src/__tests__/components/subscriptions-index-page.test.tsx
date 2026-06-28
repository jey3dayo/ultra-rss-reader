import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createQueryWrapper, createWrapper } from "@tests/helpers/create-wrapper";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type { FeedDto } from "@/api/tauri-commands";
import { SubscriptionsIndexPage } from "@/components/subscriptions-index/subscriptions-index-page";
import type { SubscriptionsIndexPageView } from "@/components/subscriptions-index/subscriptions-index-page-view";
import i18n from "@/lib/i18n";
import { queryKeys } from "@/lib/query/query-invalidation";
import type { SubscriptionDecisionActions } from "@/lib/subscriptions/subscriptions-index";
import type {
  SubscriptionDetailCandidate,
  SubscriptionDetailMetrics,
  SubscriptionListGroup,
  SubscriptionListRow,
  SubscriptionSummaryCard,
} from "@/lib/subscriptions/subscriptions-index.types";
import { usePreferencesStore } from "@/stores/preferences-store";
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
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      subscriptionsWorkspace: { kind: "index" },
    });
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    deleteFeedHandler = null;
    deleteFeedCalls = [];
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
              published_at: "2026-04-01T10:00:00Z",
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
              published_at: "2026-03-15T10:00:00Z",
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
              starred_count: 0,
            },
            {
              feed_id: "feed-2",
              latest_article_at: "2026-04-01T10:00:00Z",
              starred_count: 1,
            },
            {
              feed_id: "feed-3",
              latest_article_at: "2026-03-15T10:00:00Z",
              starred_count: 0,
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

  it("renders summary cards and selects the first feed by default", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "購読一覧" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "戻る" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "閉じる" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "全購読" })).toBeInTheDocument();
    expect(screen.getByText("総購読数")).toBeInTheDocument();
    expect(screen.getByText("見直し候補")).toBeInTheDocument();
    expect(screen.queryByText("条件")).toBeNull();
    expect(screen.queryByText("見直し候補: 更新が止まっている、または更新がないまま未読も残っていない購読")).toBeNull();
    expect(screen.getByText("90日更新なし")).toBeInTheDocument();
    expect(await screen.findAllByRole("heading", { name: "Work" })).toHaveLength(2);
    expect(document.querySelectorAll('img[src*="google.com/s2/favicons?domain=example.com"]').length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("未読 0件")).toBeInTheDocument();
    expect(screen.getByText((text) => text.startsWith("最終更新 ") && text.includes("2024"))).toBeInTheDocument();
    expect(screen.getAllByText("対応不要").length).toBeGreaterThan(0);

    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    expect(await within(detailPane).findByRole("heading", { name: "Example Feed" })).toBeInTheDocument();
    expect(detailPane.querySelector(".motion-content-swap")).toHaveAttribute("data-motion-phase", "entering");
    expect(await within(detailPane).findByText("90日以上更新なし")).toBeInTheDocument();
    expect(await within(detailPane).findByTestId("subscriptions-detail-decision-bar")).toHaveClass(
      "motion-content-swap",
      "rounded-md",
    );
  });

  it("keeps the page view props aligned with the shared subscriptions index models", () => {
    type PageViewProps = ComponentProps<typeof SubscriptionsIndexPageView>;

    expectTypeOf<PageViewProps["summaryCards"][number]>().toEqualTypeOf<SubscriptionSummaryCard>();
    expectTypeOf<PageViewProps["groups"][number]>().toEqualTypeOf<SubscriptionListGroup>();
    expectTypeOf<PageViewProps["selectedRow"]>().toEqualTypeOf<SubscriptionListRow | null>();
    expectTypeOf<PageViewProps["selectedMetrics"]>().toEqualTypeOf<SubscriptionDetailMetrics | null>();
    expectTypeOf<PageViewProps["selectedDetailCandidate"]>().toEqualTypeOf<SubscriptionDetailCandidate | null>();
    expectTypeOf<NonNullable<PageViewProps["decisionActions"]>>().toEqualTypeOf<SubscriptionDecisionActions>();
  });

  it("renders lightweight feed rows and only highlights the selected feed", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const selectedFeed = await screen.findByRole("button", {
      name: /Example Feed/,
    });
    const secondaryFeed = screen.getByRole("button", { name: /Fresh Feed/ });
    expect(selectedFeed).toHaveAccessibleName(/Example Feed/);
    expect(selectedFeed).toHaveAccessibleName(/未読 0件/);
    expect(within(secondaryFeed).getByText("対応不要").closest("[data-label-chip]")).toHaveAttribute(
      "data-label-chip",
      "neutral",
    );
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

  it("treats summary cards as in-place filters instead of workspace navigation", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const totalSubscriptionsLabel = await screen.findByRole("button", {
      name: /総購読数/,
    });
    const summarySection = totalSubscriptionsLabel.closest("section");
    expect(summarySection).not.toBeNull();
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    expect(summarySection).toHaveClass("p-0", "shadow-none");
    expect(summarySection).not.toHaveClass("rounded-md", "border");
    expect(summarySection?.querySelector(".grid")).toHaveClass("grid-cols-1", "gap-3");
    expect(summarySection?.querySelector(".grid")).toHaveClass(
      "sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]",
      "lg:gap-3",
    );
    expect(await screen.findByRole("button", { name: /見直し候補/ })).toHaveClass(
      "rounded-md",
      "border-state-warning-border/78",
      "bg-state-warning-surface/86",
    );
    expect(await screen.findByRole("button", { name: /見直し候補/ })).toHaveClass(
      "shadow-[var(--subscriptions-summary-card-shadow)]",
    );
    expect(await screen.findByRole("button", { name: /90日更新なし/ })).toHaveClass(
      "rounded-md",
      "border-state-danger-border/72",
      "bg-state-danger-surface/82",
    );
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

    const leftPaneSection = within(shell).getByRole("heading", { name: "全購読" }).closest("section");
    if (!leftPaneSection) {
      throw new Error("left pane section not found");
    }
    expect(leftPaneSection).toHaveClass("rounded-md");

    const leftPaneScrollRegion = leftPaneSection.querySelector("div.space-y-5");
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
    expect(within(firstGroupButton).getByText("1").closest("[data-label-chip]")).toHaveAttribute(
      "data-label-chip",
      "neutral",
    );
    expect(firstGroupButton).toHaveClass("motion-disclosure-trigger");
    expect(firstGroupButton.className).toMatch(/rounded-(md|lg|xl)/);
    expect(secondGroupButton.className).toMatch(/rounded-(md|lg|xl)/);
    expect(firstGroupButton).toHaveClass("border", "border-transparent");
    expect(screen.getByTestId("subscriptions-folder-tree-rail-folder-1")).toHaveClass("pl-5");
    expect(screen.getByRole("button", { name: /Example Feed/ }).parentElement).toHaveClass(
      "before:bg-[color:var(--subscriptions-list-tree-rail)]",
    );
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
    expect(detailPane).toHaveStyle({
      backgroundColor: "var(--subscriptions-detail-surface)",
    });
    expect(within(detailPane).getByRole("heading", { name: "購読の詳細" })).toHaveClass("text-foreground");
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

  it("filters the list in place from the summary cards and restores all subscriptions", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-31T00:00:00Z"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: /Example Feed/ });
    expect(screen.getByRole("button", { name: /Fresh Feed/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Loose Feed/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "まとめて処理" })).toBeNull();
    expect(screen.queryByRole("button", { name: /参照エラー/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: /見直し候補/ }));

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
    });
    expect(screen.getByRole("heading", { name: "見直し候補" })).toBeInTheDocument();
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

    const decisionBar = await within(detailPane).findByTestId("subscriptions-detail-decision-bar");
    expect(decisionBar).toBeVisible();
    const keepButton = within(detailPane).getByRole("button", {
      name: /^(残す|decision_keep)$/,
    });
    const deferButton = within(detailPane).getByRole("button", {
      name: /^(あとで|decision_defer)$/,
    });
    const deleteButton = within(detailPane).getByRole("button", {
      name: /^(削除|delete)$/,
    });
    expect(keepButton).toBeVisible();
    expect(deferButton).toBeVisible();
    expect(deleteButton).toBeVisible();
    expect(keepButton.querySelector("svg")).toHaveClass("size-4");
    expect(deferButton.querySelector("svg")).toHaveClass("size-4");
    expect(deleteButton.querySelector("svg")).toHaveClass("size-4");

    await user.click(keepButton);
    expect(useUiStore.getState().toastMessage?.message).toMatch(/^(Example Feed を残すにしました|decision_kept)$/);
    await user.click(deferButton);
    expect(useUiStore.getState().toastMessage?.message).toMatch(
      /^(Example Feed をあとで確認にしました|decision_deferred)$/,
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

    expect(within(detailPane).queryByTestId("subscriptions-detail-decision-bar")).toBeNull();
    expect(within(detailPane).getByTestId("subscriptions-detail-management-bar")).toBeInTheDocument();
    await user.click(within(detailPane).getByRole("button", { name: /^(編集|edit)$/ }));
    const editDialog = await screen.findByRole("dialog", {
      name: /^(フィードを編集|edit_feed)$/,
    });
    expect(within(editDialog).getByDisplayValue("Fresh Feed")).toBeInTheDocument();
    await user.click(within(editDialog).getByRole("button", { name: /^(キャンセル|cancel)$/ }));
    expect(within(detailPane).getByRole("button", { name: /^(削除|delete)$/ })).toBeInTheDocument();
  });

  it("removes deferred feeds from the active review filter and clears the detail pane", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-31T00:00:00Z"));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /見直し候補/ }));
    expect(await screen.findByRole("button", { name: /Example Feed/ })).toBeInTheDocument();

    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    await user.click(within(detailPane).getByRole("button", { name: "あとで" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Example Feed/ })).not.toBeInTheDocument();
    });
    expect(screen.getByText("一致する購読はありません。")).toBeInTheDocument();
    expect(within(detailPane).getByText("購読を選ぶと詳細が表示されます。")).toBeInTheDocument();
  });

  it("keeps review and stale filters inside the subscriptions index", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /見直し候補/ }));

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
    });
    expect(screen.queryByRole("button", { name: "まとめて処理" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /90日更新なし/ }));

    expect(await screen.findByRole("heading", { name: "90日更新なし" })).toBeInTheDocument();
    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
    });
  });

  it("restores a returned stale filter, collapsed group state, and list scroll position", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-03-31T00:00:00Z"));
    useUiStore.setState({
      ...useUiStore.getState(),
      subscriptionsWorkspace: {
        kind: "index",
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
          keptFeedIds: [],
          deferredFeedIds: [],
        },
      },
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const firstGroupButton = await screen.findByTestId("subscriptions-folder-row-folder-1");
    const firstGroupPanel = document.getElementById("subscriptions-group-panel-subscription-list:1-folder:folder-1");
    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    const workspaceShell = screen.getByTestId("subscriptions-workspace-shell");
    const listPane = workspaceShell.querySelector("section");
    const listScrollRegion = listPane?.querySelector("div.space-y-5");

    expect(firstGroupButton).toHaveAttribute("aria-expanded", "false");
    expect(firstGroupPanel).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button", { name: /Example Feed/ })).not.toBeInTheDocument();
    expect(within(detailPane).getByRole("heading", { name: "Example Feed" })).toBeInTheDocument();
    expect(listScrollRegion).toHaveProperty("scrollTop", 18);
  });

  it("hides feeds already marked to keep when restoring the review filter", async () => {
    useUiStore.setState({
      ...useUiStore.getState(),
      subscriptionsWorkspace: {
        kind: "index",
        returnState: {
          accountId: "acc-1",
          activeSummaryFilter: "review",
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
          keptFeedIds: ["feed-1"],
          deferredFeedIds: [],
        },
      },
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("一致する購読はありません。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Example Feed/ })).not.toBeInTheDocument();
    expect(screen.getByText("購読を選ぶと詳細が表示されます。")).toBeInTheDocument();
  });

  it("ignores returned review decisions from a different account", async () => {
    useUiStore.setState({
      ...useUiStore.getState(),
      subscriptionsWorkspace: {
        kind: "index",
        returnState: {
          accountId: "acc-2",
          activeSummaryFilter: "review",
          selectedFeedId: "feed-1",
          expandedGroups: {},
          listScrollTop: {
            scrollTop: 24,
            layoutGeneration: "feed-1",
            viewportHeight: window.innerHeight,
          },
          keptFeedIds: ["feed-1"],
          deferredFeedIds: [],
        },
      },
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "全購読" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Example Feed/ })).toBeInTheDocument();
    const workspaceShell = screen.getByTestId("subscriptions-workspace-shell");
    const listPane = workspaceShell.querySelector("section");
    const listScrollRegion = listPane?.querySelector("div.space-y-5");
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
              starred_count: 1,
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

    await user.click(await screen.findByRole("button", { name: /90日更新なし/ }));
    expect(await screen.findByText("一致する購読はありません。")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

    expect(await screen.findByRole("button", { name: /Boundary Feed/ })).toBeInTheDocument();
  });

  it("refreshes stale review labels on visibility return and cleans up the review clock", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
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
              starred_count: 1,
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

    await user.click(await screen.findByRole("button", { name: /90日更新なし/ }));
    expect(await screen.findByText("一致する購読はありません。")).toBeInTheDocument();

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

    expect(within(listPane).getByText("一致する購読はありません。")).toHaveClass("text-foreground-soft");
  });

  it("does not render the removed integrity-error entry", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: /総購読数/ });

    expect(screen.queryByRole("button", { name: /参照エラー/ })).toBeNull();
    expect(screen.queryByText("参照エラーは一覧対象外です。まとめて処理から確認できます。")).toBeNull();
  });

  it("closes the subscriptions workspace from the header action", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "閉じる" }));

    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
  });

  it("returns from the subscriptions workspace from the header action", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "戻る" }));

    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
  });

  it("closes the subscriptions workspace with Escape and returns focus to the reader pane", async () => {
    const user = userEvent.setup();

    useUiStore.setState({
      ...useUiStore.getState(),
      selectedArticleId: "art-2",
      contentMode: "reader",
      focusedPane: "content",
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.keyboard("{Escape}");

    expect(useUiStore.getState().subscriptionsWorkspace).toBeNull();
    expect(useUiStore.getState().contentMode).toBe("reader");
    expect(useUiStore.getState().focusedPane).toBe("content");
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
    });

    await user.click(within(detailPane).getByRole("button", { name: /^(削除|delete)$/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
    });
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
    await user.click(within(detailPane).getByRole("button", { name: /^(削除|delete)$/ }));
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

  it("closes stale unsubscribe targets after account scope changes", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /Example Feed/ }));
    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    await user.click(within(detailPane).getByRole("button", { name: /^(削除|delete)$/ }));
    await screen.findByRole("dialog");

    useUiStore.setState({
      ...useUiStore.getState(),
      selectedAccountId: "acc-2",
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(deleteFeedCalls).toEqual([]);
  });

  it("disables stale unsubscribe targets after the feed list refetch removes the target", async () => {
    const user = userEvent.setup();
    const { queryClient, wrapper } = createQueryWrapper({
      includeToastHost: true,
    });

    render(<SubscriptionsIndexPage />, { wrapper });

    await user.click(await screen.findByRole("button", { name: /Example Feed/ }));
    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    await user.click(within(detailPane).getByRole("button", { name: /^(削除|delete)$/ }));
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
});
