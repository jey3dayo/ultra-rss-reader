import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { FeedCleanupPage } from "@/components/feed-cleanup/feed-cleanup-page";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("FeedCleanupPage", () => {
  let feeds: Array<{
    id: string;
    account_id: string;
    folder_id: string | null;
    title: string;
    url: string;
    site_url: string;
    unread_count: number;
    reader_mode: "inherit";
    web_preview_mode: "inherit";
  }>;
  let accountArticles: Array<{
    id: string;
    feed_id: string;
    title: string;
    content_sanitized: string;
    summary: null;
    url: string;
    author: null;
    published_at: string;
    thumbnail: null;
    is_read: boolean;
    is_starred: boolean;
  }>;
  let deleteShouldFail: boolean;

  beforeEach(() => {
    feeds = [
      {
        id: "feed-1",
        account_id: "acc-1",
        folder_id: "folder-1",
        title: "Old Product Blog",
        url: "https://example.com/old.xml",
        site_url: "https://example.com/old",
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
        unread_count: 2,
        reader_mode: "inherit",
        web_preview_mode: "inherit",
      },
    ];
    accountArticles = [
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
    deleteShouldFail = false;

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      feedCleanupOpen: true,
      selectedAccountId: "acc-1",
    });
    usePreferencesStore.setState({ prefs: {}, loaded: true });

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return [
            {
              id: "acc-1",
              kind: "local",
              name: "Local",
              username: null,
              server_url: null,
              sync_interval_secs: 3600,
              sync_on_wake: false,
              keep_read_items_days: 30,
            },
          ];
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return feeds;
        case "list_account_articles":
          return accountArticles;
        case "delete_feed":
          if (deleteShouldFail) {
            throw { type: "UserVisible", message: "boom" };
          }
          feeds = feeds.filter((feed) => feed.id !== args.feedId);
          accountArticles = accountArticles.filter((article) => article.feed_id !== args.feedId);
          return null;
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });
  });

  it("filters candidates, updates the review panel, and deletes a confirmed feed", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "Feed Cleanup" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Old Product Blog" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "No unread" }));
    await user.click(screen.getByRole("button", { name: "Old Product Blog" }));

    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("No unread articles")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Later" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Old Product Blog" })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Show deferred" }));
    await user.click(screen.getByRole("button", { name: "Old Product Blog" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    const deleteDialog = screen.getByRole("dialog", { name: "Delete feed" });

    expect(within(deleteDialog).getByText("Old Product Blog")).toBeInTheDocument();
    expect(within(deleteDialog).getByText("Why this feed is here")).toBeInTheDocument();
    expect(within(deleteDialog).getByText("No unread articles")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Old Product Blog" })).not.toBeInTheDocument();
    });
  });

  it("keeps the candidate visible and leaves the dialog closable when delete fails", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Old Product Blog" });
    await user.click(screen.getByRole("button", { name: "Old Product Blog" }));

    deleteShouldFail = true;
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("dialog", { name: "Delete feed" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByText("Delete feed")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Old Product Blog" })).toBeInTheDocument();
    });
  });
});
