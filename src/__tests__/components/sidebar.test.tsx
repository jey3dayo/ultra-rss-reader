import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/reader/sidebar";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleAccounts, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

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

describe("Sidebar", () => {
  beforeEach(() => {
    syncCompletedListener = null;
    syncProgressListener = null;
    renderedFeedContextMenuFeeds.length = 0;
    useUiStore.setState(useUiStore.getInitialState());
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    setupTauriMocks();
  });

  it("keeps smart views and the feeds header outside the scroll area and delegates smart view selection", async () => {
    const user = userEvent.setup();
    render(<Sidebar />, { wrapper: createWrapper() });

    const unreadButton = screen.getByRole("button", { name: /Unread/ });
    const feedsHeader = screen.getByRole("button", { name: "Feeds" });

    expect(unreadButton.closest('[data-slot="scroll-area"]')).toBeNull();
    expect(feedsHeader.closest('[data-slot="scroll-area"]')).toBeNull();

    await user.click(unreadButton);
    expect(useUiStore.getState().selection).toEqual({ type: "smart", kind: "unread" });
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
        default:
          return null;
      }
    });
    useUiStore.setState({
      ...useUiStore.getState(),
      expandedFolderIds: new Set(["folder-1"]),
    });

    render(<Sidebar />, { wrapper: createWrapper() });

    await screen.findByRole("button", { name: /Folder Feed/ });
    expect(renderedFeedContextMenuFeeds).toContainEqual(
      expect.objectContaining({ id: "feed-1", folder_id: "folder-1" }),
    );
  });

  it("renders feeds after data loads", async () => {
    render(<Sidebar />, { wrapper: createWrapper() });

    // After accounts load, the first account is auto-selected, which triggers feeds query
    await waitFor(
      () => {
        expect(screen.getByText("Tech Blog")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.getByText("News")).toBeInTheDocument();
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

  it("does not update last synced time when sync is skipped", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "trigger_sync") return { synced: false, total: 0, succeeded: 0, failed: [] };
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

  it("spins the sync button and enables app loading while sync-progress is active", async () => {
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
    expect(screen.getByRole("button", { name: "Feeds" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Unread/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Starred/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Tags" })).not.toBeInTheDocument();
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
