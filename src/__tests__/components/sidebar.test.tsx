import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/reader/sidebar";
import { APP_EVENTS } from "@/constants/events";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleAccounts, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

const { devIntentState } = vi.hoisted(() => ({
  devIntentState: {
    intent: null as string | null,
  },
}));

let syncCompletedListener: (() => void) | null = null;
let syncProgressListener:
  | ((event: {
      stage: string;
      kind: string;
      total: number;
      completed: number;
      account_id?: string | null;
      account_name?: string | null;
      success?: boolean | null;
    }) => void)
  | null = null;
const renderedFeedContextMenuFeeds: Array<{ id: string; folder_id: string | null }> = [];

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (eventName: string, callback: typeof syncCompletedListener | typeof syncProgressListener) => {
    if (eventName === "sync-completed") {
      syncCompletedListener = callback as typeof syncCompletedListener;
    }
    if (eventName === "sync-progress") {
      syncProgressListener = callback as typeof syncProgressListener;
    }
    return () => {
      if (eventName === "sync-completed") {
        syncCompletedListener = null;
      }
      if (eventName === "sync-progress") {
        syncProgressListener = null;
      }
    };
  }),
}));

vi.mock("@/components/reader/feed-context-menu", () => ({
  FeedContextMenuContent: ({ feed }: { feed: { id: string; folder_id: string | null } }) => {
    renderedFeedContextMenuFeeds.push(feed);
    return null;
  },
}));

vi.mock("@/hooks/use-resolved-dev-intent", () => ({
  useResolvedDevIntent: () => ({
    intent: devIntentState.intent,
    ready: true,
  }),
}));

describe("Sidebar", () => {
  beforeEach(() => {
    syncCompletedListener = null;
    syncProgressListener = null;
    renderedFeedContextMenuFeeds.length = 0;
    devIntentState.intent = null;
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    setupTauriMocks();
  });

  it("keeps smart views and the subscriptions header outside the scroll area and delegates smart view selection", async () => {
    const user = userEvent.setup();
    render(<Sidebar />, { wrapper: createWrapper() });

    const smartViewsHeading = screen.getByText("Smart views");
    const unreadButton = screen.getByRole("button", { name: /Unread/ });
    const feedsHeader = screen.getByRole("button", { name: "Subscriptions" });

    expect(smartViewsHeading.closest('[data-slot="scroll-area"]')).toBeNull();
    expect(unreadButton.closest('[data-slot="scroll-area"]')).toBeNull();
    expect(feedsHeader.closest('[data-slot="scroll-area"]')).toBeNull();

    await user.click(unreadButton);
    expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "unread" });
  });

  it("selects starred smart view with all-mode semantics so the article list can show all starred items", async () => {
    const user = userEvent.setup();
    render(<Sidebar />, { wrapper: createWrapper() });

    const starredButton = screen.getByRole("button", { name: /Starred/ });

    await user.click(starredButton);

    expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "starred" });
    expect(useUiStore.getState().viewMode).toBe("all");
  });

  it("allows the feed list scroll area to shrink inside the sidebar column layout", () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    const scrollArea = screen.getByTestId("sidebar-feed-scroll-area");

    expect(scrollArea).toHaveClass("flex-1");
    expect(scrollArea).toHaveClass("min-h-0");
  });

  it("preserves folder_id when opening feed context menus for folder-backed feeds", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            {
              ...sampleFeeds[0],
              folder_id: "folder-1",
              title: "Folder Feed",
            },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return null;
      }
    });
    useUiStore.setState({
      ...useUiStore.getState(),
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await screen.findByText("Folder Feed");
    expect(renderedFeedContextMenuFeeds).toContainEqual(
      expect.objectContaining({ id: "feed-1", folder_id: "folder-1" }),
    );
  });

  it("shows only unread feeds from the selected folder when viewMode is unread", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-unread", title: "Unread Feed", folder_id: "folder-1", unread_count: 3 },
            { ...sampleFeeds[1], id: "feed-read", title: "Read Feed", folder_id: "folder-1", unread_count: 0 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return null;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "folder", folderId: "folder-1" },
      viewMode: "unread",
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByText("Unread Feed")).toBeInTheDocument();
    expect(screen.queryByText("Read Feed")).not.toBeInTheDocument();
  });

  it("shows all feeds from the selected folder when viewMode is all", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-unread", title: "Unread Feed", folder_id: "folder-1", unread_count: 3 },
            { ...sampleFeeds[1], id: "feed-read", title: "Read Feed", folder_id: "folder-1", unread_count: 0 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return null;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "folder", folderId: "folder-1" },
      viewMode: "all",
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByText("Unread Feed")).toBeInTheDocument();
    expect(screen.getByText("Read Feed")).toBeInTheDocument();
  });

  it("hides folders that have no unread feeds in unread smart view", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [
            { id: "folder-unread", account_id: args.accountId, name: "Unread Folder", sort_order: 0 },
            { id: "folder-empty", account_id: args.accountId, name: "Empty Folder", sort_order: 1 },
          ];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-unread", title: "Unread Feed", folder_id: "folder-unread", unread_count: 3 },
            { ...sampleFeeds[1], id: "feed-read", title: "Read Feed", folder_id: "folder-empty", unread_count: 0 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return null;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "smart", kind: "unread" },
      viewMode: "unread",
      expandedFolderIds: new Set(["folder-unread", "folder-empty"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByText("Unread Folder")).toBeInTheDocument();
    expect(screen.queryByText("Empty Folder")).not.toBeInTheDocument();
  });

  it("shows only unread feeds in the main list when viewMode is unread", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-unread", title: "Unread Feed", folder_id: null, unread_count: 3 },
            { ...sampleFeeds[1], id: "feed-read", title: "Read Feed", folder_id: null, unread_count: 0 },
          ].filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return null;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "all" },
      viewMode: "unread",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByText("Unread Feed")).toBeInTheDocument();
    expect(screen.queryByText("Read Feed")).not.toBeInTheDocument();
  });

  it("expands the selected folder when clicking its row", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-unread", title: "Unread Feed", folder_id: "folder-1", unread_count: 3 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return null;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      expandedFolderIds: new Set(),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    const folderButton = await screen.findByRole("button", { name: "Select folder Work" });
    await user.click(folderButton);

    expect(await screen.findByText("Unread Feed")).toBeInTheDocument();
    expect(useUiStore.getState().selection).toEqual({ type: "folder", folderId: "folder-1" });
    expect(useUiStore.getState().expandedFolderIds.has("folder-1")).toBe(true);
  });

  it("updates a feed folder when moving it onto an empty folder", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-empty", account_id: args.accountId, name: "Empty", sort_order: 0 }];
        case "list_feeds":
          return [{ ...sampleFeeds[0], title: "Tech Blog", folder_id: null }];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        case "update_feed_folder":
          return null;
        default:
          return null;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "Drag Tech Blog" }));
    fireEvent.click(await screen.findByRole("button", { name: "Move to Empty" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "update_feed_folder",
        args: { feedId: "feed-1", folderId: "folder-empty" },
      });
    });
  });

  it("does not call update_feed_folder when moving into the same folder", async () => {
    const calls: Array<{ cmd: string; args: Record<string, unknown> }> = [];

    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [{ ...sampleFeeds[0], title: "Folder Feed", folder_id: "folder-1" }];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        case "update_feed_folder":
          return null;
        default:
          return null;
      }
    });
    useUiStore.setState({
      ...useUiStore.getState(),
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.click(await screen.findByRole("button", { name: "Drag Folder Feed" }));
    fireEvent.click(await screen.findByRole("button", { name: "Move to Work" }));

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(calls).not.toContainEqual({
      cmd: "update_feed_folder",
      args: { feedId: "feed-1", folderId: "folder-1" },
    });
  });

  it("clears drag state when the feeds section closes mid-drag", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [{ ...sampleFeeds[0], title: "Tech Blog", folder_id: null }];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return null;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    const handle = await screen.findByRole("button", { name: "Drag Tech Blog" });
    fireEvent.click(handle);

    expect(await screen.findByRole("button", { name: "Move to Work" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Subscriptions" }));
    await user.click(screen.getByRole("button", { name: "Subscriptions" }));

    expect(screen.queryByRole("button", { name: "Move to Work" })).not.toBeInTheDocument();
  });

  it("hides read feeds by default and shows them again in all view", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(
      () => {
        expect(screen.getByText("Tech Blog")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.queryByText("News")).not.toBeInTheDocument();

    useUiStore.getState().setViewMode("all");

    await waitFor(() => {
      expect(screen.getByText("News")).toBeInTheDocument();
    });
  });

  it("shows unread count for feeds with unread articles", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(
      () => {
        expect(screen.getByText("Tech Blog")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    // Tech Blog has unread_count: 5 (also shown in total unread)
    const fives = screen.getAllByText("5");
    expect(fives.length).toBeGreaterThanOrEqual(1);
  });

  it("does not auto-select the first account while the direct web preview dev intent is active", async () => {
    devIntentState.intent = "open-web-preview-url";
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_folders":
          return [];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return null;
      }
    });
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      contentMode: "browser",
      browserUrl: "https://example.com",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().selectedAccountId).toBeNull();
    });

    expect(useUiStore.getState().selectedAccountId).toBeNull();
    expect(useUiStore.getState().contentMode).toBe("browser");
    expect(useUiStore.getState().browserUrl).toBe("https://example.com");
  });

  it("selects the unread smart view when choosing the startup account", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().selectedAccountId).toBe("acc-1");
      expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "unread" });
    });

    expect(useUiStore.getState().viewMode).toBe("unread");
  });

  it("moves focus to the newly selected feed during keyboard feed navigation", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [{ id: "folder-1", account_id: args.accountId, name: "Work", sort_order: 0 }];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-1", title: "Alpha Feed", folder_id: "folder-1", unread_count: 4 },
            { ...sampleFeeds[1], id: "feed-2", title: "Beta Feed", folder_id: "folder-1", unread_count: 2 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return null;
      }
    });

    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      viewMode: "all",
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await screen.findByText("Alpha Feed");
    const alphaFeed = document.querySelector('[data-feed-id="feed-1"]') as HTMLButtonElement | null;
    expect(alphaFeed).not.toBeNull();
    if (!alphaFeed) {
      throw new Error("Expected feed button for feed-1");
    }
    await user.click(alphaFeed);
    expect(alphaFeed).toHaveFocus();

    window.dispatchEvent(new CustomEvent(APP_EVENTS.navigateFeed, { detail: 1 as const }));

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-2" });
    });

    const betaFeed = document.querySelector('[data-feed-id="feed-2"]') as HTMLButtonElement | null;
    expect(betaFeed).not.toBeNull();
    if (!betaFeed) {
      throw new Error("Expected feed button for feed-2");
    }

    await waitFor(() => {
      expect(betaFeed).toHaveFocus();
    });
  });

  it("expands folders with unread feeds on startup when that policy is enabled", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [
            { id: "folder-open", account_id: args.accountId, name: "Open Me", sort_order: 0 },
            { id: "folder-closed", account_id: args.accountId, name: "Keep Closed", sort_order: 1 },
          ];
        case "list_feeds":
          return [
            { ...sampleFeeds[0], id: "feed-open", title: "Unread Feed", folder_id: "folder-open", unread_count: 3 },
            { ...sampleFeeds[1], id: "feed-closed", title: "Read Feed", folder_id: "folder-closed", unread_count: 0 },
          ];
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return null;
      }
    });

    usePreferencesStore.setState({
      prefs: { startup_folder_expansion: "unread_folders" },
      loaded: true,
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: "Select folder Open Me" });

    await waitFor(() => {
      expect(useUiStore.getState().expandedFolderIds.has("folder-open")).toBe(true);
      expect(useUiStore.getState().expandedFolderIds.has("folder-closed")).toBe(false);
    });
  });

  it("does not update last synced time when sync is skipped", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "trigger_sync") return { synced: false, total: 0, succeeded: 0, failed: [], warnings: [] };
      return null;
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByLabelText("Sync feeds"));

    await waitFor(() => {
      expect(screen.getByText("Not synced yet")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Today at /)).not.toBeInTheDocument();
  });

  it("updates last synced time from sync-completed event", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    expect(screen.getByText("Not synced yet")).toBeInTheDocument();
    expect(syncCompletedListener).not.toBeNull();

    syncCompletedListener?.();

    await waitFor(() => {
      expect(screen.getByText(/Today at /)).toBeInTheDocument();
    });
  });

  it("shows a warning toast when sync completes with anomalies", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "trigger_sync") {
        return {
          synced: true,
          total: 1,
          succeeded: 1,
          failed: [],
          warnings: [{ account_id: "acc-2", account_name: "FreshRSS", message: "Skipped 3 entries." }],
        };
      }
      return null;
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    fireEvent.click(screen.getByLabelText("Sync feeds"));

    await waitFor(() => {
      expect(useUiStore.getState().toastMessage).toEqual({
        message: "Sync completed with warnings for: FreshRSS",
      });
    });
  });

  it("keeps the sync button idle for manual account sync progress", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    const syncButton = await screen.findByRole("button", { name: "Sync feeds" });
    const icon = syncButton.querySelector("svg");

    expect(syncProgressListener).not.toBeNull();
    expect(icon).not.toHaveClass("animate-spin");
    expect(useUiStore.getState().appLoading).toBe(false);

    syncProgressListener?.({
      stage: "started",
      kind: "manual_account",
      total: 1,
      completed: 0,
      account_id: "acc-1",
      account_name: "Local",
      success: null,
    });

    await waitFor(() => {
      expect(icon).not.toHaveClass("animate-spin");
      expect(useUiStore.getState().appLoading).toBe(false);
    });
  });

  it("spins the sync button and enables app loading while full sync-progress is active", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    const syncButton = await screen.findByRole("button", { name: "Sync feeds" });
    const icon = syncButton.querySelector("svg");

    expect(syncProgressListener).not.toBeNull();
    expect(icon).not.toHaveClass("animate-spin");
    expect(useUiStore.getState().appLoading).toBe(false);

    syncProgressListener?.({
      stage: "started",
      kind: "manual_all",
      total: 2,
      completed: 0,
      account_id: null,
      account_name: null,
      success: null,
    });

    await waitFor(() => {
      expect(icon).toHaveClass("animate-spin");
      expect(useUiStore.getState().appLoading).toBe(true);
    });

    syncProgressListener?.({
      stage: "finished",
      kind: "manual_all",
      total: 2,
      completed: 2,
      account_id: null,
      account_name: null,
      success: true,
    });

    await waitFor(() => {
      expect(icon).not.toHaveClass("animate-spin");
      expect(useUiStore.getState().appLoading).toBe(false);
    });
  });

  it("opens the account switcher with expanded state and closes it on Escape", async () => {
    const user = userEvent.setup();
    render(<Sidebar />, { wrapper: createWrapper() });

    const trigger = await screen.findByRole("button", { name: /Local/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);

    const menu = await screen.findByRole("menu", { name: "Accounts" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(menu).toBeInTheDocument();

    fireEvent.keyDown(menu, { key: "Escape" });

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
    expect(trigger).toHaveFocus();
  });

  it("keeps the account switcher visible on mobile when restoring a saved account", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      layoutMode: "mobile",
      focusedPane: "sidebar",
    });
    usePreferencesStore.setState({
      prefs: {
        selected_account_id: "acc-2",
      },
      loaded: true,
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().selectedAccountId).toBe("acc-2");
      expect(useUiStore.getState().focusedPane).toBe("sidebar");
    });
    expect(screen.getByRole("button", { name: /FreshRSS/ })).toBeInTheDocument();
  });

  it("reselects a valid account when the current selection no longer exists", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-missing",
    });

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_folders":
          return [];
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return null;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().selectedAccountId).toBe("acc-1");
    });
    expect(screen.getByRole("button", { name: /Local/ })).toBeInTheDocument();
  });

  it("clears the account selection when no accounts remain", async () => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-missing",
    });

    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "list_accounts":
          return [];
        case "list_folders":
        case "list_feeds":
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return null;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(useUiStore.getState().selectedAccountId).toBeNull();
    });
    expect(screen.getByRole("heading", { name: "Ultra RSS" })).toBeInTheDocument();
  });

  it("offers an add-account empty state action when no accounts are available", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "list_accounts":
          return [];
        case "list_folders":
        case "list_feeds":
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return null;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    const addAccountButton = await screen.findByRole("button", { name: "Add an account to get started" });

    await user.click(addAccountButton);

    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().settingsCategory).toBe("accounts");
    expect(useUiStore.getState().settingsAddAccount).toBe(true);
  });

  it("routes the header add-feed action to account settings when no account is available", async () => {
    const user = userEvent.setup();

    setupTauriMocks((cmd) => {
      switch (cmd) {
        case "list_accounts":
          return [];
        case "list_folders":
        case "list_feeds":
        case "list_account_articles":
          return [];
        case "list_tags":
          return [];
        case "get_tag_article_counts":
          return {};
        default:
          return null;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Add feed" }));

    expect(useUiStore.getState().settingsOpen).toBe(true);
    expect(useUiStore.getState().settingsCategory).toBe("accounts");
    expect(useUiStore.getState().settingsAddAccount).toBe(true);
  });

  it("hides configurable sections while keeping accounts and feeds visible", async () => {
    usePreferencesStore.setState({
      prefs: {
        show_sidebar_unread: "false",
        show_sidebar_starred: "false",
        show_sidebar_tags: "false",
      },
      loaded: true,
    });

    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return [];
        case "list_tags":
          return [{ id: "tag-1", name: "Important", color: "#ff0000" }];
        case "get_tag_article_counts":
          return { "tag-1": 2 };
        default:
          return null;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    expect(await screen.findByRole("button", { name: /Local/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subscriptions" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Unread/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Starred/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tags" })).not.toBeInTheDocument();
  });

  it("keeps the feeds and tags section controls alongside the feed scroll area", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return [];
        case "list_tags":
          return [{ id: "tag-1", name: "Important", color: "#ff0000" }];
        case "get_tag_article_counts":
          return { "tag-1": 2 };
        default:
          return null;
      }
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    const feedsButton = await screen.findByRole("button", { name: "Subscriptions" });
    const tagsButton = await screen.findByRole("button", { name: "Tags" });
    const scrollArea = screen.getByTestId("sidebar-feed-scroll-area");

    expect(feedsButton.closest('[data-slot="scroll-area"]')).toBeNull();
    expect(tagsButton.closest('[data-slot="scroll-area"]')).toBe(scrollArea);
    expect(scrollArea).toBeInTheDocument();
  });

  it("keeps footer actions outside the scroll area and opens settings from the bottom action row", async () => {
    const user = userEvent.setup();

    render(<Sidebar />, { wrapper: createWrapper() });

    const scrollArea = screen.getByTestId("sidebar-feed-scroll-area");
    const feedCleanupButton = await screen.findByRole("button", { name: "Feed Cleanup" });
    const settingsButton = screen.getByRole("button", { name: "Settings" });

    expect(feedCleanupButton.closest('[data-slot="scroll-area"]')).toBeNull();
    expect(settingsButton.closest('[data-slot="scroll-area"]')).toBeNull();
    expect(scrollArea).toBeInTheDocument();

    await user.click(settingsButton);

    expect(useUiStore.getState().settingsOpen).toBe(true);
  });

  it("opens the feed cleanup surface from the bottom management area", async () => {
    const user = userEvent.setup();

    render(<Sidebar />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Feed Cleanup" }));

    expect(useUiStore.getState().feedCleanupOpen).toBe(true);
    expect(useUiStore.getState().focusedPane).toBe("content");
  });

  it("keeps footer actions clickable after collapsing the feeds section", async () => {
    const user = userEvent.setup();

    render(<Sidebar />, { wrapper: createWrapper() });

    await user.click(await screen.findByRole("button", { name: "Subscriptions" }));

    expect(screen.queryByText("Tech Blog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(useUiStore.getState().settingsOpen).toBe(true);

    await user.click(screen.getByRole("button", { name: "Feed Cleanup" }));
    expect(useUiStore.getState().feedCleanupOpen).toBe(true);
  });

  it("falls back away from hidden sidebar states, including viewMode-only flows", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_accounts":
          return sampleAccounts;
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_account_articles":
          return [];
        case "list_tags":
          return [{ id: "tag-1", name: "Important", color: "#ff0000" }];
        case "get_tag_article_counts":
          return { "tag-1": 2 };
        default:
          return null;
      }
    });

    useUiStore.setState({
      ...useUiStore.getState(),
      selectedAccountId: "acc-1",
      selection: { type: "feed", feedId: "feed-1" },
      viewMode: "starred",
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    usePreferencesStore.getState().setPref("show_sidebar_starred", "false");

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
      expect(useUiStore.getState().viewMode).toBe("all");
    });

    useUiStore.getState().selectSmartView("unread");
    usePreferencesStore.getState().setPref("show_sidebar_unread", "false");

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
    });

    usePreferencesStore.getState().setPref("show_sidebar_unread", "true");

    expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
  });
});
