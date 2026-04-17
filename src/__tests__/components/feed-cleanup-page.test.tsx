import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
      subscriptionsWorkspace: { kind: "cleanup", cleanupContext: null },
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

    await user.click(within(screen.getByTestId("feed-cleanup-review-actions")).getByRole("button", { name: "削除" }));

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
    const closeButton = screen.getByRole("button", { name: "Close" });
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).toHaveTextContent("");
    expect(screen.getByRole("heading", { name: "Cleanup Queue" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Review" })).toBeInTheDocument();
    expect(screen.getByTestId("feed-cleanup-sidebar-summary")).toBeInTheDocument();
    expect(screen.getByTestId("feed-cleanup-page")).toHaveClass("h-dvh");
    expect(screen.getByTestId("feed-cleanup-page")).toHaveStyle({ backgroundImage: "var(--cleanup-shell-bg)" });
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Decided")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Old Product Blog" })).toBeInTheDocument();
    expect(screen.getByTestId("feed-cleanup-queue-row-feed-2")).toHaveClass("bg-card/24");
    expect(screen.getByTestId("feed-cleanup-queue-row-feed-1")).toHaveClass("rounded-md");
    expect(screen.getByTestId("feed-cleanup-queue-row-feed-1")).toHaveClass("bg-card/36");
    expect(screen.getByRole("button", { name: "90+ days inactive 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No unread 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No stars 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No unread 1" })).toHaveClass("rounded-md");

    await user.click(screen.getByRole("button", { name: "No unread 1" }));
    await user.click(screen.getByRole("button", { name: "Old Product Blog" }));

    const queueRow = screen.getByTestId("feed-cleanup-queue-row-feed-1");
    expect(queueRow).toHaveClass("bg-card/36");
    expect(within(queueRow).getByRole("button", { name: "Defer" })).toBeInTheDocument();
    expect(within(queueRow).getByRole("button", { name: "Delete" })).toBeInTheDocument();
    expect(within(queueRow).getByRole("button", { name: "Keep" })).toHaveClass("bg-state-success-surface");

    const reviewPanel = screen.getByTestId("feed-cleanup-review-panel");
    expect(within(reviewPanel).getByText("Why this feed is here")).toBeInTheDocument();
    expect(within(reviewPanel).getByRole("link", { name: "Old Product Blog" })).toBeInTheDocument();
    expect(within(reviewPanel).getByRole("button", { name: "Edit Feed" })).toBeInTheDocument();
    expect(within(reviewPanel).getByText("Folder")).toBeInTheDocument();
    expect(within(reviewPanel).getByText("Latest article")).toBeInTheDocument();
    expect(screen.getByTestId("feed-cleanup-layout")).toHaveClass("grid-cols-[minmax(0,1fr)_480px]");
    expect(screen.getByTestId("feed-cleanup-layout")).toHaveClass("gap-6");
    expect(screen.getByTestId("feed-cleanup-layout")).toHaveClass("overflow-hidden");
    expect(screen.getByTestId("feed-cleanup-review-panel")).toHaveClass("sticky");
    expect(screen.getByTestId("feed-cleanup-review-panel")).toHaveClass("top-0");

    await user.click(within(queueRow).getByRole("button", { name: "Defer" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Old Product Blog" })).not.toBeInTheDocument();
    });

    expect(screen.getByText("Old Product Blog deferred")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show deferred" }));
    await user.click(screen.getByRole("button", { name: "Old Product Blog" }));
    await user.click(
      within(screen.getByTestId("feed-cleanup-queue-row-feed-1")).getByRole("button", { name: "Delete" }),
    );

    const deleteDialog = screen.getByRole("dialog", { name: "Delete feed" });
    const warningCard = within(deleteDialog).getByText("This action removes the subscription from this account.");

    expect(within(deleteDialog).getByText("Old Product Blog")).toBeInTheDocument();
    expect(within(deleteDialog).getByText("Why this feed is here")).toBeInTheDocument();
    expect(within(deleteDialog).getByText("No unread")).toBeInTheDocument();
    expect(within(deleteDialog).getByText("No stars")).toBeInTheDocument();
    expect(warningCard).toHaveClass("rounded-md");

    await user.click(within(deleteDialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Old Product Blog" })).not.toBeInTheDocument();
    });
  });

  it("uses softened support surfaces for integrity banners and shortcut cards", async () => {
    const user = userEvent.setup();

    integrityReport = {
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

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    const integritySummary = await screen.findByText((content) => /missing feed|存在しないフィード/.test(content));
    expect(integritySummary.closest("div.rounded-md")).toHaveClass("bg-surface-1/78");

    await user.click(screen.getByRole("button", { name: "Shortcuts" }));

    const dialog = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    const shortcutRow = within(dialog).getByText("Next feed").closest("div.rounded-md");
    const shortcutKey = within(dialog).getByText("J");

    expect(shortcutRow).toHaveClass("bg-surface-1/72");
    expect(shortcutKey).toHaveClass("bg-surface-1/80");
  });

  it("shows a back action to the subscriptions index when opened from there", async () => {
    const user = userEvent.setup();

    useUiStore.setState({
      ...useUiStore.getState(),
      subscriptionsWorkspace: {
        kind: "cleanup",
        cleanupContext: { reason: "stale_90d", returnTo: "index" },
      },
    });

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Back to subscriptions" }));

    expect(useUiStore.getState().subscriptionsWorkspace).toEqual({
      kind: "index",
      cleanupContext: null,
    });
    expect("feedCleanupOpen" in useUiStore.getState()).toBe(false);
  });

  it("keeps the candidate visible and leaves the dialog closable when delete fails", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Old Product Blog" });
    await user.click(screen.getByRole("button", { name: "Old Product Blog" }));

    deleteShouldFail = true;
    await user.click(
      within(screen.getByTestId("feed-cleanup-queue-row-feed-1")).getByRole("button", { name: "Delete" }),
    );
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

    expect(await screen.findByText("Broken feed references found")).toBeInTheDocument();
    expect(await screen.findByText("1 article is pointing to a missing feed.")).toHaveClass("mt-1");
    const warningCard = screen.getByText("Broken feed references found").closest("div");
    expect(warningCard).toHaveClass("rounded-md", "border-state-warning-border");
    expect(warningCard?.parentElement).toHaveClass("bg-state-warning-surface", "text-state-warning-foreground");
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
    expect(screen.getByLabelText("Website URL").closest("div.space-y-3")).toHaveClass("rounded-md");

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

  it("keeps selected cleanup candidates from the bulk action bar", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Old Product Blog" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fresh Feed" })).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Select candidate Old Product Blog" }));
    await user.click(screen.getByRole("checkbox", { name: "Select candidate Fresh Feed" }));
    await user.click(screen.getByRole("button", { name: "Keep selected" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Old Product Blog" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Fresh Feed" })).not.toBeInTheDocument();
    });
  });

  it("defers selected cleanup candidates from the bulk action bar", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: "Old Product Blog" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fresh Feed" })).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Select candidate Old Product Blog" }));
    await user.click(screen.getByRole("checkbox", { name: "Select candidate Fresh Feed" }));
    await user.click(screen.getByRole("button", { name: "Defer selected" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Old Product Blog" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Fresh Feed" })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Show deferred" }));

    expect(await screen.findByRole("button", { name: "Old Product Blog" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fresh Feed" })).toBeInTheDocument();
  });

  it("applies bulk actions only to the currently selected filtered candidates", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Old Product Blog" });
    await user.click(screen.getByRole("button", { name: "No unread 1" }));
    await user.click(screen.getByRole("checkbox", { name: "Select candidate Old Product Blog" }));
    await user.click(screen.getByRole("button", { name: "Keep selected" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Old Product Blog" })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "No unread 0" }));

    expect(screen.getByRole("button", { name: "Fresh Feed" })).toBeInTheDocument();
  });

  it("hides selection bulk actions while reviewing broken references", async () => {
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

    expect(screen.queryByRole("button", { name: "Keep selected" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Defer selected" })).not.toBeInTheDocument();
  });

  it("shows no bulk action bar when nothing is selected", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Old Product Blog" });
    expect(screen.getByRole("button", { name: "Keep selected" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Select candidate Old Product Blog" }));
    expect(screen.getByRole("button", { name: "Keep selected" })).toBeEnabled();
    await user.click(screen.getByRole("checkbox", { name: "Select candidate Old Product Blog" }));
    expect(screen.getByRole("button", { name: "Keep selected" })).toBeDisabled();
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

  it("routes cleanup keyboard actions to the selected set before the focused row", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Old Product Blog" });

    const queueHeading = screen.getByRole("heading", { name: "Cleanup Queue" });
    const queueSection = queueHeading.closest("section");
    if (!queueSection) {
      throw new Error("Cleanup queue section not found");
    }

    expect(screen.getByTestId("feed-cleanup-queue-row-feed-1")).toHaveAttribute("data-focused", "true");

    await user.keyboard(" ");

    expect(screen.getByRole("checkbox", { name: "Select candidate Old Product Blog" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    await user.keyboard("j");
    expect(screen.getByTestId("feed-cleanup-queue-row-feed-2")).toHaveAttribute("data-focused", "true");

    await user.keyboard("l");

    expect(screen.getByRole("button", { name: "Fresh Feed" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Old Product Blog" })).not.toBeInTheDocument();
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
    expect(screen.getByText("Old Product Blog deferred")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("suspends cleanup keyboard actions while the delete dialog is open", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Old Product Blog" });

    expect(screen.getByTestId("feed-cleanup-queue-row-feed-1")).toHaveAttribute("data-focused", "true");

    await user.keyboard(" ");

    expect(screen.getByRole("checkbox", { name: "Select candidate Old Product Blog" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "d" });

    const deleteDialog = await screen.findByRole("dialog", { name: "Delete feed" });
    expect(deleteDialog).toBeInTheDocument();

    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "K", shiftKey: true });

    expect(screen.getByRole("dialog", { name: "Delete feed" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select candidate Old Product Blog", hidden: true })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("button", { name: "Old Product Blog", hidden: true })).toBeInTheDocument();
    expect(screen.queryByText("Old Product Blog kept")).not.toBeInTheDocument();
  });

  it("opens the shortcut help modal from the header and keyboard", async () => {
    const user = userEvent.setup();

    render(<FeedCleanupPage />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Old Product Blog" });

    await user.click(screen.getByRole("button", { name: "Shortcuts" }));

    const shortcutsDialog = screen.getByRole("dialog", { name: "Keyboard shortcuts" });
    expect(shortcutsDialog).toBeInTheDocument();
    expect(shortcutsDialog).toHaveClass("rounded-xl");
    expect(shortcutsDialog).toHaveStyle({ backgroundColor: "var(--cleanup-dialog-surface)" });
    expect(screen.getByText("Navigation")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Next feed")).toBeInTheDocument();
    expect(screen.getAllByText("Help").length).toBeGreaterThan(0);
    expect(within(shortcutsDialog).getByText("Next feed").closest("div")).toHaveClass("rounded-md");
    expect(within(shortcutsDialog).getByText("Keep").closest("div")).toHaveClass("rounded-md");

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Keyboard shortcuts" })).not.toBeInTheDocument();
    });

    await user.keyboard("?");

    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
  });
});
