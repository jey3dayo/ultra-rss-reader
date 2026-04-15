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
    expect(screen.getByText("E")).toBeInTheDocument();
    expect(screen.getByText("F")).toBeInTheDocument();
    expect(screen.getByText("未読 0件")).toBeInTheDocument();
    expect(screen.getByText("最終更新 2024/1/1")).toBeInTheDocument();
    expect(screen.getAllByText("整理不要").length).toBeGreaterThan(0);

    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    expect(within(detailPane).getByRole("heading", { name: "Example Feed" })).toBeInTheDocument();
    expect(within(detailPane).getByText("90日以上更新なし")).toBeInTheDocument();
  });

  it("renders lightweight feed rows and only highlights the selected feed", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const selectedFeed = await screen.findByRole("button", { name: /Example Feed/ });
    const secondaryFeed = screen.getByRole("button", { name: /Fresh Feed/ });

    expect(selectedFeed).toHaveAccessibleName(/Example Feed/);
    expect(selectedFeed).toHaveAccessibleName(/Work/);
    expect(selectedFeed).toHaveAccessibleName(/未読 0件/);
    expect(selectedFeed).toHaveAttribute("aria-pressed", "true");
    expect(selectedFeed).toHaveClass("bg-surface-1");
    expect(selectedFeed).toHaveClass("focus-visible:ring-2");
    expect(secondaryFeed).toHaveAccessibleName(/Fresh Feed/);
    expect(secondaryFeed).toHaveAccessibleName(/未読 3件/);
    expect(secondaryFeed).toHaveAttribute("aria-pressed", "false");
    expect(secondaryFeed).not.toHaveClass("bg-card/75");
  });

  it("keeps the subscriptions workspace shell aligned with the lighter left pane", async () => {
    const { container } = render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    const shell = await screen.findByTestId("subscriptions-workspace-shell");
    expect(shell).toHaveClass("min-h-0");
    expect(shell).toHaveClass("overflow-hidden");
    expect(shell).toHaveClass("grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)]");

    const leftPaneSection = within(shell).getByRole("heading", { name: "全購読" }).closest("section");
    if (!leftPaneSection) {
      throw new Error("left pane section not found");
    }

    const leftPaneScrollRegion = leftPaneSection.querySelector("div.overflow-y-auto");
    expect(leftPaneScrollRegion).toBeTruthy();
    expect(leftPaneScrollRegion).toHaveClass("min-h-0");
    expect(leftPaneScrollRegion).toHaveClass("flex-1");
    expect(leftPaneScrollRegion).toHaveClass("overflow-y-auto");

    expect(container.querySelector("[data-browser-overlay-root]")).toBeNull();
  });

  it("exposes folder rows as drop targets in the subscriptions tree", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findAllByRole("heading", { name: "Work" })).toHaveLength(2);
    expect(screen.getByTestId("subscriptions-folder-row-folder-1")).toHaveAttribute("data-folder-drop-target", "true");
    expect(screen.getByTestId("subscriptions-folder-row-folder-2")).toHaveAttribute("data-folder-drop-target", "true");
  });

  it("shows selected feed details and a cleanup hand-off action", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /Example Feed/ }));

    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    expect(within(detailPane).getByRole("link", { name: "Example Feed" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(within(detailPane).getByText("Work")).toBeInTheDocument();
    expect(within(detailPane).queryByRole("link", { name: "フィードのURL" })).toBeNull();
    expect(within(detailPane).getByText("記事の表示")).toBeInTheDocument();
    expect(within(detailPane).getByText("既定の表示")).toBeInTheDocument();
    const articleLink = within(detailPane).getByRole("link", { name: "Old article" });
    expect(articleLink).toHaveAttribute("href", "https://example.com/old/1");
    expect(articleLink).toHaveClass("cursor-pointer");
    expect(within(detailPane).getByRole("button", { name: "購読の整理" })).toBeInTheDocument();

    const detailScrollRegion = detailPane.querySelector("div.overflow-y-auto");
    expect(detailScrollRegion).toBeTruthy();
    expect(detailScrollRegion).toHaveClass("min-h-0");
    expect(detailScrollRegion).toHaveClass("flex-1");
    expect(detailScrollRegion).toHaveClass("overflow-y-auto");
  });

  it("opens cleanup with stale context from the summary action", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /止まった購読を見る/ }));

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "cleanup",
      cleanupContext: { reason: "stale_90d", returnTo: "index" },
    });
    expect("feedCleanupOpen" in useUiStore.getState()).toBe(false);
  });

  it("opens cleanup with broken-references context from the summary action", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: /参照エラーを見る/ }));

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "cleanup",
      cleanupContext: { reason: "broken_references", returnTo: "index" },
    });
    expect("feedCleanupOpen" in useUiStore.getState()).toBe(false);
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
});
