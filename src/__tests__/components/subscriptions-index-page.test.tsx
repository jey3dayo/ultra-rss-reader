import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { SubscriptionsIndexPage } from "@/components/subscriptions-index/subscriptions-index-page";
import i18n from "@/lib/i18n";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("SubscriptionsIndexPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("ja");
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      subscriptionsWorkspace: { kind: "index", cleanupContext: null },
    });
    usePreferencesStore.setState({ prefs: {}, loaded: true });

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return [
            {
              id: "feed-1",
              account_id: "acc-1",
              folder_id: "folder-1",
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
              title: "Loose Feed",
              url: "https://example.com/loose.xml",
              site_url: "https://example.com/loose",
              unread_count: 1,
              reader_mode: "inherit",
              web_preview_mode: "inherit",
            },
          ];
        case "list_folders":
          return [
            { id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 },
            { id: "folder-2", account_id: args.accountId, name: "Work", sort_order: 1 },
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
        default:
          return undefined;
      }
    });
  });

  it("renders summary cards and selects the first feed by default", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "購読一覧" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "戻る" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "閉じる" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "全購読" })).toBeInTheDocument();
    expect(screen.getByText("総購読数")).toBeInTheDocument();
    expect(screen.getByText("要確認")).toBeInTheDocument();
    expect(screen.getByText("90日停止")).toBeInTheDocument();
    expect(screen.getByText("参照エラー")).toBeInTheDocument();
    expect(await screen.findAllByRole("heading", { name: "Work" })).toHaveLength(2);
    expect(document.querySelectorAll('img[src*="google.com/s2/favicons?domain=example.com"]').length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("未読 0件")).toBeInTheDocument();
    expect(screen.getByText("最終更新 2024/1/1")).toBeInTheDocument();
    expect(screen.getAllByText("整理不要").length).toBeGreaterThan(0);

    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    expect(await within(detailPane).findByRole("heading", { name: "Example Feed" })).toBeInTheDocument();
    expect(await within(detailPane).findByText("90日以上更新なし")).toBeInTheDocument();
    expect(await within(detailPane).findByTestId("subscriptions-detail-decision-bar")).toHaveClass("rounded-md");
  });

  it("renders lightweight feed rows and only highlights the selected feed", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const selectedFeed = await screen.findByRole("button", { name: /Example Feed/ });
    const secondaryFeed = screen.getByRole("button", { name: /Fresh Feed/ });
    expect(selectedFeed).toHaveAccessibleName(/Example Feed/);
    expect(selectedFeed).toHaveAccessibleName(/未読 0件/);
    expect(within(secondaryFeed).getByText("整理不要").closest("[data-label-chip]")).toHaveAttribute(
      "data-label-chip",
      "neutral",
    );
    expect(selectedFeed).toHaveAttribute("aria-pressed", "true");
    expect(selectedFeed).toHaveClass("transition-[background-color,border-color,box-shadow,transform]");
    expect(selectedFeed).toHaveClass("bg-[color:var(--subscriptions-list-row-selected-surface)]");
    expect(selectedFeed).toHaveClass("shadow-[var(--subscriptions-list-row-selected-shadow)]");
    expect(selectedFeed).toHaveClass("focus-visible:ring-2");
    expect(selectedFeed.className).toMatch(/rounded-(md|lg|xl)/);
    const selectedFaviconSurface = selectedFeed.querySelector("span.rounded-md");
    expect((selectedFaviconSurface as HTMLElement).style.backgroundColor).toBe(
      "var(--subscriptions-list-favicon-surface)",
    );
    expect((selectedFaviconSurface as HTMLElement).style.borderColor).toBe("var(--subscriptions-list-divider)");
    expect(selectedFeed.querySelector('img[src*="google.com/s2/favicons?domain=example.com"]')).toHaveClass(
      "h-5",
      "w-5",
    );
    expect(secondaryFeed).toHaveAccessibleName(/Fresh Feed/);
    expect(secondaryFeed).toHaveAccessibleName(/未読 3件/);
    expect(secondaryFeed).toHaveAttribute("aria-pressed", "false");
    expect(secondaryFeed).not.toHaveClass("bg-card/75");
    const secondaryFaviconSurface = secondaryFeed.querySelector("span.rounded-md");
    expect((secondaryFaviconSurface as HTMLElement).style.backgroundColor).toBe(
      "var(--subscriptions-list-favicon-surface-muted)",
    );
    expect((secondaryFaviconSurface as HTMLElement).style.borderColor).toBe("var(--subscriptions-list-divider)");
    expect(selectedFeed.querySelector('img[src*="google.com/s2/favicons?domain=example.com"]')).toBeTruthy();
  });

  it("treats summary cards as in-place filters instead of cleanup navigation", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const totalSubscriptionsLabel = await screen.findByRole("button", { name: /総購読数/ });
    const summarySection = totalSubscriptionsLabel.closest("section");
    expect(summarySection).not.toBeNull();
    expect(summarySection).toHaveClass("rounded-lg", "border-border/55");
    expect(summarySection).toHaveStyle({ backgroundColor: "var(--subscriptions-summary-surface)" });
    expect(summarySection?.querySelector(".grid")).toHaveClass("grid-cols-1", "gap-3");
    expect(summarySection?.querySelector(".grid")).toHaveClass("lg:grid-cols-[0.96fr_1.12fr_0.96fr_0.96fr]");
    expect(await screen.findByRole("button", { name: /要確認/ })).toHaveClass(
      "rounded-lg",
      "border-state-review-border/80",
      "bg-state-review-surface/86",
    );
    expect(await screen.findByRole("button", { name: /要確認/ })).toHaveClass(
      "shadow-[var(--subscriptions-summary-card-shadow)]",
    );
    expect(await screen.findByRole("button", { name: /90日停止/ })).toHaveClass("rounded-lg");
    expect(await screen.findByRole("button", { name: /参照エラー/ })).toHaveClass("rounded-lg");
  });

  it("keeps the subscriptions workspace shell aligned with the lighter left pane", async () => {
    const { container } = render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

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

    expect(screen.getByTestId("subscriptions-detail-pane")).toHaveClass("rounded-md");

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
    expect(firstGroupButton.style.borderColor).toBe("var(--subscriptions-list-divider)");
  });

  it("collapses and re-expands a single group while keeping the current detail selection", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const firstGroupButton = await screen.findByTestId("subscriptions-folder-row-folder-1");
    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    const firstGroupPanel = document.getElementById("subscriptions-group-panel-folder-1");

    expect(screen.getByRole("button", { name: /Example Feed/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fresh Feed/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Loose Feed/ })).toBeInTheDocument();
    expect(await within(detailPane).findByRole("heading", { name: "Example Feed" })).toBeInTheDocument();
    expect(firstGroupPanel).toHaveAttribute("aria-hidden", "false");
    expect(firstGroupPanel).toHaveClass("motion-disclosure-panel");

    await user.click(firstGroupButton);

    expect(firstGroupButton).toHaveAttribute("aria-expanded", "false");
    expect(firstGroupButton).toHaveClass("shadow-[var(--subscriptions-list-group-collapsed-shadow)]");
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
    expect(detailPane).toHaveStyle({ backgroundColor: "var(--subscriptions-detail-surface)" });
    expect(within(detailPane).getByRole("heading", { name: "購読の詳細" })).toHaveClass("text-foreground-soft");
    expect(within(detailPane).getByRole("link", { name: "Example Feed" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(within(detailPane).getByText("Work")).toBeInTheDocument();
    expect(within(detailPane).queryByRole("link", { name: "フィードのURL" })).toBeNull();
    expect(within(detailPane).getByText("記事の表示")).toBeInTheDocument();
    expect(within(detailPane).getByText("既定の表示")).toBeInTheDocument();
    expect(detailPane.querySelector('img[src*="google.com/s2/favicons?domain=example.com"]')).toBeTruthy();
    expect(detailPane.querySelector('img[src*="google.com/s2/favicons?domain=example.com"]')).toHaveClass("h-6", "w-6");
    const articleLink = within(detailPane).getByRole("link", { name: "Old article" });
    expect(articleLink).toHaveAttribute("href", "https://example.com/old/1");
    expect(articleLink).toHaveClass("cursor-pointer");
    expect(within(detailPane).queryByRole("button", { name: "購読の整理" })).toBeNull();

    const detailScrollRegion = detailPane.querySelector("div.pr-2");
    expect(detailScrollRegion).toBeTruthy();
    expect(detailScrollRegion).toHaveClass("lg:min-h-0");
    expect(detailScrollRegion).toHaveClass("lg:flex-1");
    expect(detailScrollRegion).toHaveClass("lg:overflow-y-auto");
  });

  it("filters the list in place from the summary cards and restores all subscriptions", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: /Example Feed/ });
    expect(screen.getByRole("button", { name: /Fresh Feed/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Loose Feed/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /要確認/ }));

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
      cleanupContext: null,
    });
    expect(screen.getByRole("heading", { name: "要確認" })).toBeInTheDocument();
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

    expect(await within(detailPane).findByTestId("subscriptions-detail-decision-bar")).toBeInTheDocument();
    expect(within(detailPane).getByRole("button", { name: "残す" })).toBeInTheDocument();
    expect(within(detailPane).getByRole("button", { name: "あとで" })).toBeInTheDocument();
    expect(within(detailPane).getByRole("button", { name: "削除" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Fresh Feed/ }));

    expect(within(detailPane).queryByTestId("subscriptions-detail-decision-bar")).toBeNull();
  });

  it("opens feed cleanup from the currently filtered subset", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /要確認/ }));
    await user.click(screen.getByRole("button", { name: "まとめて処理" }));

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "cleanup",
      cleanupContext: {
        reason: "review",
        feedIds: ["feed-1"],
        returnTo: "index",
        returnState: {
          activeSummaryFilter: "review",
          selectedFeedId: "feed-1",
          expandedGroups: {},
          listScrollTop: 0,
          keptFeedIds: [],
          deferredFeedIds: [],
        },
      },
    });
  });

  it("restores a returned stale filter, collapsed group state, and list scroll position", async () => {
    useUiStore.setState({
      ...useUiStore.getState(),
      subscriptionsWorkspace: {
        kind: "index",
        cleanupContext: null,
        returnState: {
          activeSummaryFilter: "stale",
          selectedFeedId: "feed-1",
          expandedGroups: {
            "folder-1": false,
            "folder-2": true,
            __ungrouped__: true,
          },
          listScrollTop: 18,
          keptFeedIds: [],
          deferredFeedIds: [],
        },
      },
    });

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const firstGroupButton = await screen.findByTestId("subscriptions-folder-row-folder-1");
    const firstGroupPanel = document.getElementById("subscriptions-group-panel-folder-1");
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

  it("hides feeds already kept in cleanup when returning to the review filter", async () => {
    useUiStore.setState({
      ...useUiStore.getState(),
      subscriptionsWorkspace: {
        kind: "index",
        cleanupContext: null,
        returnState: {
          activeSummaryFilter: "review",
          selectedFeedId: "feed-1",
          expandedGroups: {
            "folder-1": true,
            "folder-2": true,
            __ungrouped__: true,
          },
          listScrollTop: 0,
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

  it("keeps the empty detail surface on the rounded-md baseline", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const emptyDetail = await screen.findByText("購読を選ぶと詳細が表示されます。");
    expect(emptyDetail.className).toMatch(/rounded-(md|lg|xl)/);
    expect(emptyDetail).toHaveClass("bg-surface-1/78");
    expect(emptyDetail).toHaveClass("text-foreground-soft");
  });

  it("renders the empty detail surface with the rounded-md baseline when no feeds exist", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return [];
        case "list_folders":
          return [
            { id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 },
            { id: "folder-2", account_id: args.accountId, name: "Work", sort_order: 1 },
          ];
        case "list_account_articles":
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
    expect(emptySurface).toHaveClass("bg-surface-1/78");
    expect(emptySurface).toHaveClass("text-foreground-soft");
  });

  it("renders the empty subscription list with supportive copy tone when no feeds exist", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return [];
        case "list_folders":
          return [
            { id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 },
            { id: "folder-2", account_id: args.accountId, name: "Work", sort_order: 1 },
          ];
        case "list_account_articles":
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

    const inventoryHeading = await screen.findByRole("heading", { name: "全購読" });
    const listPane = inventoryHeading.closest("section");

    if (!listPane) {
      throw new Error("subscriptions list pane not found");
    }

    expect(within(listPane).getByText("一致する購読はありません。")).toHaveClass("text-foreground-soft");
  });

  it("applies the broken filter without navigating away", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /参照エラー/ }));

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
      cleanupContext: null,
    });
    expect(screen.queryByRole("button", { name: /Example Feed/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("参照エラーは一覧対象外です。まとめて処理から確認できます。")).toHaveLength(2);
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
});
