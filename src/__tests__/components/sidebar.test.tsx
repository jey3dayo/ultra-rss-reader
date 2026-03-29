import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "@/components/reader/sidebar";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleAccounts, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

let syncCompletedListener: (() => void) | null = null;
const renderedFeedContextMenuFeeds: Array<{ id: string; folder_id: string | null }> = [];

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (eventName: string, callback: () => void) => {
    if (eventName === "sync-completed") {
      syncCompletedListener = callback;
    }
    return () => {
      if (eventName === "sync-completed") {
        syncCompletedListener = null;
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
    renderedFeedContextMenuFeeds.length = 0;
    useUiStore.setState(useUiStore.getInitialState());
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
      if (cmd === "trigger_sync") return false;
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
});
