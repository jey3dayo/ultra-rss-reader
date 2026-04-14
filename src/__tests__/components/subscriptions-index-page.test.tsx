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
              folder_id: null,
              title: "Fresh Feed",
              url: "https://example.com/fresh.xml",
              site_url: "https://example.com/fresh",
              unread_count: 3,
              reader_mode: "inherit",
              web_preview_mode: "inherit",
            },
          ];
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
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
              published_at: "2025-11-01T10:00:00Z",
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

  it("renders summary cards and an empty right pane before selecting a feed", async () => {
    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "購読一覧" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "全購読" })).toBeInTheDocument();
    expect(screen.getByText("総購読数")).toBeInTheDocument();
    expect(screen.getByText("要確認")).toBeInTheDocument();
    expect(screen.getByText("90日停止")).toBeInTheDocument();
    expect(screen.getByText("参照エラー")).toBeInTheDocument();
    expect(await screen.findByText("Work")).toBeInTheDocument();
    expect(screen.getByText("未読 0件")).toBeInTheDocument();
    expect(screen.getByText("最終更新 2025/11/1")).toBeInTheDocument();
    expect(screen.getByText("整理不要")).toBeInTheDocument();

    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    expect(within(detailPane).getByText("購読を選ぶと詳細が表示されます。")).toBeInTheDocument();
  });

  it("shows selected feed details and a cleanup hand-off action", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Example Feed" }));

    const detailPane = screen.getByTestId("subscriptions-detail-pane");
    expect(within(detailPane).getByRole("heading", { name: "Example Feed" })).toBeInTheDocument();
    expect(within(detailPane).getByRole("heading", { name: "購読の詳細" })).toBeInTheDocument();
    expect(within(detailPane).getByText("Work")).toBeInTheDocument();
    expect(within(detailPane).getByText("WebサイトのURL")).toBeInTheDocument();
    expect(within(detailPane).getByRole("link", { name: "https://example.com" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
    expect(within(detailPane).getByText("フィードのURL")).toBeInTheDocument();
    expect(within(detailPane).getByRole("link", { name: "https://example.com/feed.xml" })).toHaveAttribute(
      "href",
      "https://example.com/feed.xml",
    );
    expect(within(detailPane).getByText("記事の表示")).toBeInTheDocument();
    expect(within(detailPane).getByText("既定の表示")).toBeInTheDocument();
    const articleLink = within(detailPane).getByRole("link", { name: "Old article" });
    expect(articleLink).toHaveAttribute("href", "https://example.com/old/1");
    expect(articleLink).toHaveClass("cursor-pointer", "underline");
    expect(within(detailPane).getByRole("button", { name: "購読の整理で開く" })).toBeInTheDocument();
  });

  it("opens cleanup with stale context from the summary action", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "90日以上更新なしを整理する" }));

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "cleanup",
      cleanupContext: { reason: "stale_90d", returnTo: "index" },
    });
    expect(useUiStore.getState().feedCleanupOpen).toBe(true);
  });

  it("opens cleanup with broken-references context from the summary action", async () => {
    const user = userEvent.setup();

    render(<SubscriptionsIndexPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "壊れた参照を確認する" }));

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "cleanup",
      cleanupContext: { reason: "broken_references", returnTo: "index" },
    });
    expect(useUiStore.getState().feedCleanupOpen).toBe(true);
  });
});
