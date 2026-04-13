import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeedCleanupPage } from "@/components/feed-cleanup/feed-cleanup-page";
import i18n from "@/lib/i18n";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("FeedCleanupPage", () => {
  let calls: Array<{ cmd: string; args: Record<string, unknown> }>;
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
  let integrityReport: {
    orphaned_article_count: number;
    orphaned_feeds: Array<{
      missing_feed_id: string;
      article_count: number;
      latest_article_title: string | null;
      latest_article_published_at: string | null;
    }>;
  };

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1264,
    });
    calls = [];
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
    integrityReport = { orphaned_article_count: 0, orphaned_feeds: [] };

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      feedCleanupOpen: true,
      selectedAccountId: "acc-1",
    });
    usePreferencesStore.setState({ prefs: {}, loaded: true });

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

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
        case "get_feed_integrity_report":
          return integrityReport;
        case "delete_feed":
          if (deleteShouldFail) {
            throw { type: "UserVisible", message: "boom" };
          }
          feeds = feeds.filter((feed) => feed.id !== args.feedId);
          accountArticles = accountArticles.filter((article) => article.feed_id !== args.feedId);
          return null;
        case "rename_feed":
        case "update_feed_display_settings":
        case "update_feed_folder":
        case "copy_to_clipboard":
          return null;
        case "trigger_sync_feed":
          return { synced: true, total: 1, succeeded: 1, failed: [], warnings: [] };
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return undefined;
      }
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("formats cleanup dates in the active UI language", async () => {
    const user = userEvent.setup();
    const toLocaleDateStringSpy = vi.spyOn(Date.prototype, "toLocaleDateString");

    await i18n.changeLanguage("ja");

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Old Product Blog" }));

    expect(screen.getByText("2025年11月1日")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "削除" }));

    const deleteDialog = await screen.findByRole("dialog", { name: "フィードを削除" });

    expect(within(deleteDialog).getByText(/最新記事: 2025年11月1日/)).toBeInTheDocument();
    expect(toLocaleDateStringSpy).toHaveBeenCalledWith(
      "ja",
      expect.objectContaining({
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    );
  });

  it("filters candidates, updates the review panel, and deletes a confirmed feed", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "Review Subscriptions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cleanup Queue" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByTestId("feed-cleanup-sidebar-summary")).toBeInTheDocument();
    expect(screen.getByTestId("feed-cleanup-page")).toHaveClass("h-dvh");
    expect(await screen.findByText("2 candidates")).toBeInTheDocument();
    expect(await screen.findByText("1 review now")).toBeInTheDocument();
    expect(await screen.findByText("0 deferred")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Old Product Blog" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "90+ days inactive 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No unread 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No stars 1" })).toBeInTheDocument();
    expect(screen.getAllByText("Review now").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Keep" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Later" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toHaveAttribute("data-delete-button");

    await user.click(screen.getByRole("button", { name: "No unread 1" }));
    await user.click(screen.getByRole("button", { name: "Old Product Blog" }));

    expect(screen.getAllByText("Work").length).toBeGreaterThan(0);
    expect(screen.getAllByText("No unread articles").length).toBeGreaterThan(0);
    const reviewPanel = screen.getByTestId("feed-cleanup-review-panel");
    expect(within(reviewPanel).getAllByText("Review now").length).toBeGreaterThan(0);
    expect(within(reviewPanel).getByText("No new article for 90+ days")).toBeInTheDocument();
    expect(within(reviewPanel).getByText("Why this feed is here")).toBeInTheDocument();
    expect(within(reviewPanel).getByText("Folder")).toBeInTheDocument();
    expect(within(reviewPanel).getByText("Latest article")).toBeInTheDocument();
    expect(within(reviewPanel).getByText("Unread")).toBeInTheDocument();
    expect(within(reviewPanel).getByText("Starred")).toBeInTheDocument();
    expect(within(reviewPanel).getByText("90+ days quiet with no unread backlog.")).toBeInTheDocument();

    const queueCandidate = screen.getByRole("button", { name: "Old Product Blog" });
    expect(queueCandidate).not.toHaveTextContent(/Work · \d+d · 0 unread · 0 starred/);
    expect(screen.getByTestId("feed-cleanup-layout")).toHaveClass("grid-cols-[minmax(0,1fr)_300px]");
    expect(screen.getByTestId("feed-cleanup-layout")).toHaveClass("gap-5");
    expect(screen.getByTestId("feed-cleanup-layout")).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("feed-cleanup-review-panel")).toHaveClass("sticky");
    expect(screen.getByTestId("feed-cleanup-review-panel")).toHaveClass("top-0");

    await user.click(screen.getByRole("button", { name: "Later" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Old Product Blog" })).not.toBeInTheDocument();
    });

    expect(screen.getByText("1 deferred")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show deferred" }));
    await user.click(screen.getByRole("button", { name: "Old Product Blog" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    const deleteDialog = screen.getByRole("dialog", { name: "Delete feed" });

    expect(within(deleteDialog).getByText("Old Product Blog")).toBeInTheDocument();
    expect(within(deleteDialog).getByText("Why this feed is here")).toBeInTheDocument();
    expect(within(deleteDialog).getByText("No unread articles")).toBeInTheDocument();
    expect(within(deleteDialog).getByText("No starred articles")).toBeInTheDocument();

    await user.click(within(deleteDialog).getByRole("button", { name: "Delete" }));

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
    const reviewPanel = screen.getByTestId("feed-cleanup-review-panel");
    await user.click(within(reviewPanel).getByRole("button", { name: "Delete" }));
    const deleteDialog = await screen.findByRole("dialog", { name: "Delete feed" });
    await user.click(within(deleteDialog).getByRole("button", { name: "Delete" }));

    expect(deleteDialog).toBeInTheDocument();

    await user.click(within(deleteDialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Delete feed" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Old Product Blog" })).toBeInTheDocument();
    });
  });

  it("surfaces broken feed references in the management summary", async () => {
    integrityReport = {
      orphaned_article_count: 1,
      orphaned_feeds: [
        {
          missing_feed_id: "missing-feed",
          article_count: 1,
          latest_article_title: "Broken article",
          latest_article_published_at: "2026-03-31T10:00:00Z",
        },
      ],
    };

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    expect(await screen.findByText("Integrity issues")).toBeInTheDocument();
    expect(await screen.findByText("1 broken reference")).toBeInTheDocument();
    expect(await screen.findByText("1 article is pointing to a missing feed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show broken references" })).toBeInTheDocument();
  });

  it("switches the queue to broken references when requested", async () => {
    const user = userEvent.setup();
    integrityReport = {
      orphaned_article_count: 2,
      orphaned_feeds: [
        {
          missing_feed_id: "missing-feed",
          article_count: 2,
          latest_article_title: "Broken article",
          latest_article_published_at: "2026-03-31T10:00:00Z",
        },
      ],
    };

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Show broken references" }));

    expect(screen.getByRole("heading", { name: "Broken references" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Missing feed: missing-feed" })).toBeInTheDocument();
    expect(screen.getAllByText("Needs repair before cleanup").length).toBeGreaterThan(0);
    expect(screen.getByText("2 articles are pointing at this missing feed.")).toBeInTheDocument();
    expect(screen.getByText("Cleanup filters are hidden while you review broken references.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "90+ days inactive 1" })).not.toBeInTheDocument();
  });

  it("opens directly in broken references mode for the dedicated dev intent", async () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_INTENT", "open-feed-cleanup-broken-references");
    integrityReport = {
      orphaned_article_count: 2,
      orphaned_feeds: [
        {
          missing_feed_id: "ghost-feed-001",
          article_count: 2,
          latest_article_title: "Broken article",
          latest_article_published_at: "2026-03-31T10:00:00Z",
        },
      ],
    };

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("heading", { name: "Broken references" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Missing feed: ghost-feed-001" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show cleanup queue" })).toBeInTheDocument();
    expect(screen.getByText("Cleanup filters are hidden while you review broken references.")).toBeInTheDocument();
  });

  it("opens the inline editor and saves edited feed details", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Old Product Blog" }));
    await user.click(screen.getByRole("button", { name: "Edit Feed" }));

    expect(screen.getByRole("heading", { name: "Edit Feed" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maintenance" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refetch feed" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Unsubscribe" })).toHaveAttribute("data-delete-button");
    expect(screen.getByLabelText("Title")).toHaveValue("Old Product Blog");
    expect(screen.getByRole("combobox", { name: "Article display" })).toHaveTextContent("Use default");
    expect(screen.getByRole("combobox", { name: "Folder" })).toHaveTextContent("Work");
    expect(screen.getByLabelText("Website URL")).toHaveValue("https://example.com/old");
    expect(screen.getByLabelText("Feed URL")).toHaveValue("https://example.com/old.xml");

    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Archived Product Blog");
    await user.click(screen.getByRole("combobox", { name: "Article display" }));
    await user.click(await screen.findByText("Web Preview"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Edit Feed" })).not.toBeInTheDocument();
    });

    expect(calls).toContainEqual({
      cmd: "rename_feed",
      args: { feedId: "feed-1", title: "Archived Product Blog" },
    });
    expect(calls).toContainEqual({
      cmd: "update_feed_display_settings",
      args: { feedId: "feed-1", readerMode: "on", webPreviewMode: "on" },
    });
  });

  it("syncs the selected feed from the maintenance section", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Old Product Blog" }));
    await user.click(screen.getByRole("button", { name: "Edit Feed" }));
    await user.click(screen.getByRole("button", { name: "Refetch feed" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "trigger_sync_feed",
        args: { feedId: "feed-1" },
      });
    });
  });

  it("opens the delete confirmation from the maintenance section", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Old Product Blog" }));
    await user.click(screen.getByRole("button", { name: "Edit Feed" }));
    await user.click(screen.getByRole("button", { name: "Unsubscribe" }));

    expect(await screen.findByRole("dialog", { name: "Delete feed" })).toBeInTheDocument();
  });

  it("keeps all visible cleanup candidates from the overview actions", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Old Product Blog" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fresh Feed" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Keep all visible" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Old Product Blog" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Fresh Feed" })).not.toBeInTheDocument();
    });

    expect(screen.getByText("0 candidates")).toBeInTheDocument();
  });

  it("defers all visible cleanup candidates from the overview actions", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Old Product Blog" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fresh Feed" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Defer all visible" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Old Product Blog" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Fresh Feed" })).not.toBeInTheDocument();
    });

    expect(screen.getByText("2 deferred")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show deferred" }));

    expect(await screen.findByRole("button", { name: "Old Product Blog" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fresh Feed" })).toBeInTheDocument();
  });

  it("applies bulk actions only to the currently visible filtered candidates", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Old Product Blog" });
    await user.click(screen.getByRole("button", { name: "No unread 1" }));
    await user.click(screen.getByRole("button", { name: "Keep all visible" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Old Product Blog" })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "No unread 0" }));

    expect(screen.getByRole("button", { name: "Fresh Feed" })).toBeInTheDocument();
  });

  it("hides overview bulk actions while reviewing broken references", async () => {
    const user = userEvent.setup();
    integrityReport = {
      orphaned_article_count: 1,
      orphaned_feeds: [
        {
          missing_feed_id: "missing-feed",
          article_count: 1,
          latest_article_title: "Broken article",
          latest_article_published_at: "2026-03-31T10:00:00Z",
        },
      ],
    };

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Show broken references" }));

    expect(screen.queryByRole("button", { name: "Keep all visible" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Defer all visible" })).not.toBeInTheDocument();
  });

  it("disables overview bulk actions when there are no visible candidates", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Old Product Blog" });
    await user.click(screen.getByRole("button", { name: "Keep all visible" }));

    await waitFor(() => {
      expect(screen.getByText("0 candidates")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Keep all visible" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Defer all visible" })).toBeDisabled();
  });

  it("keeps the queue in normal document flow on narrow screens", async () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 390,
    });

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Old Product Blog" });

    expect(screen.getByTestId("feed-cleanup-layout")).toHaveClass("flex-col");
    expect(screen.getByTestId("feed-cleanup-layout")).not.toHaveClass("overflow-hidden");
    expect(screen.getByTestId("feed-cleanup-review-panel")).not.toHaveClass("sticky");
    expect(screen.getByTestId("feed-cleanup-queue-list")).not.toHaveClass("h-[calc(100%-2rem)]");
    expect(screen.getByTestId("feed-cleanup-queue-list")).not.toHaveClass("overflow-y-auto");
  });
});
