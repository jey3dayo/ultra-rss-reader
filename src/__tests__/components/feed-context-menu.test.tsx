import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { sampleFeeds } from "@tests/helpers/fixtures";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import type { MockTauriCommandCall } from "@tests/helpers/tauri-types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as tauriCommands from "@/api/tauri-commands";
import { FeedContextMenuContent } from "@/components/reader/feed-context-menu";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const { deleteFeedMutateAsyncMock, unsubscribeDialogPropsRef, sameSiteFeedIndexRef } = vi.hoisted(() => ({
  deleteFeedMutateAsyncMock: vi.fn(),
  unsubscribeDialogPropsRef: {
    current: null as null | {
      open: boolean;
      pending?: boolean;
      onConfirm: () => void;
    },
  },
  sameSiteFeedIndexRef: {
    current: new Map() as Map<string | null, { feedIds: string[]; unreadCount: number }>,
  },
}));

vi.mock("@/components/reader/feed-context-menu-view", () => ({
  FeedContextMenuView: ({
    openSiteLabel,
    hasUnreadArticles,
    markSameSiteFeedsReadLabel,
    hasSameSiteUnread,
    onOpenSite,
    onMarkSameSiteFeedsRead,
    onUnsubscribe,
  }: {
    openSiteLabel: string;
    hasUnreadArticles: boolean;
    markSameSiteFeedsReadLabel?: string;
    hasSameSiteUnread?: boolean;
    onOpenSite: () => void;
    onMarkSameSiteFeedsRead?: () => void;
    onUnsubscribe: () => void;
  }) => (
    <>
      <button type="button" data-has-unread-articles={String(hasUnreadArticles)} onClick={onOpenSite}>
        {openSiteLabel}
      </button>
      {markSameSiteFeedsReadLabel && hasSameSiteUnread && onMarkSameSiteFeedsRead && (
        <button type="button" onClick={onMarkSameSiteFeedsRead}>
          {markSameSiteFeedsReadLabel}
        </button>
      )}
      <button type="button" onClick={onUnsubscribe}>
        Unsubscribe…
      </button>
    </>
  ),
}));

vi.mock("@/components/reader/feed-edit-dialog", () => ({
  FeedEditDialog: () => null,
}));

vi.mock("@/components/reader/unsubscribe-feed-dialog", () => ({
  UnsubscribeDialog: (props: { open: boolean; pending?: boolean; onConfirm: () => void }) => {
    unsubscribeDialogPropsRef.current = props;
    return null;
  },
}));

vi.mock("@/hooks/use-articles", () => ({
  useMarkFeedRead: () => ({ mutate: vi.fn() }),
  useMarkOldUnreadRead: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/hooks/use-confirm-mark-all-read", () => ({
  useConfirmMarkAllRead: () => vi.fn(),
}));

vi.mock("@/hooks/use-delete-feed", () => ({
  useDeleteFeed: () => ({ isPending: false, mutateAsync: deleteFeedMutateAsyncMock }),
}));

vi.mock("@/hooks/use-feeds", () => ({
  useFeeds: () => ({ data: [] }),
}));

vi.mock("@/hooks/use-mark-same-site-feeds-read", () => ({
  useMarkSameSiteFeedsRead: () => vi.fn(),
}));

vi.mock("@/hooks/use-same-site-feed-index", () => ({
  useSameSiteFeedIndex: () => sameSiteFeedIndexRef.current,
}));

describe("FeedContextMenuContent", () => {
  let calls: MockTauriCommandCall[] = [];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    unsubscribeDialogPropsRef.current = null;
    deleteFeedMutateAsyncMock.mockResolvedValue(undefined);
    sameSiteFeedIndexRef.current = new Map();
    calls = [];
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("opens the feed site in the background when the background preference is enabled", async () => {
    usePreferencesStore.setState({ prefs: { open_links_background: "true" }, loaded: true });
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "open_in_browser":
          return null;
        default:
          return undefined;
      }
    });

    render(<FeedContextMenuContent feed={sampleFeeds[0]} />);

    fireEvent.click(screen.getByRole("button", { name: "Open example.com" }));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "open_in_browser",
        args: { url: "https://example.com", background: true },
      });
    });
  });

  it("surfaces open site failures with a toast", async () => {
    const showToast = vi.fn();
    useUiStore.setState({ showToast });
    setupTauriMocks((cmd, args) => {
      calls.push({ cmd, args });

      switch (cmd) {
        case "open_in_browser":
          throw { type: "UserVisible", message: "Browser unavailable" };
        default:
          return undefined;
      }
    });

    render(<FeedContextMenuContent feed={sampleFeeds[0]} />);

    fireEvent.click(screen.getByRole("button", { name: "Open example.com" }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Browser unavailable");
    });
    expect(calls).toContainEqual({
      cmd: "open_in_browser",
      args: { url: "https://example.com", background: false },
    });
  });

  it("surfaces rejected open site commands with a toast", async () => {
    const showToast = vi.fn();
    useUiStore.setState({ showToast });
    vi.spyOn(tauriCommands, "openInBrowser").mockRejectedValue(new Error("Native command rejected"));

    render(<FeedContextMenuContent feed={sampleFeeds[0]} />);

    fireEvent.click(screen.getByRole("button", { name: "Open example.com" }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith("Native command rejected");
    });
  });

  it("passes zero unread feeds as unavailable for mark all read", () => {
    const feed = { ...sampleFeeds[0], unread_count: 0 };

    render(<FeedContextMenuContent feed={feed} />);

    expect(screen.getByRole("button", { name: "Open example.com" })).toHaveAttribute(
      "data-has-unread-articles",
      "false",
    );
  });

  it("guards unsubscribe confirmation while the delete mutation is pending", async () => {
    let resolveDelete: () => void = () => {};
    deleteFeedMutateAsyncMock.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveDelete = resolve;
      }),
    );

    render(<FeedContextMenuContent feed={sampleFeeds[0]} />);

    fireEvent.click(screen.getByRole("button", { name: "Unsubscribe…" }));
    expect(unsubscribeDialogPropsRef.current?.open).toBe(true);

    await act(async () => {
      unsubscribeDialogPropsRef.current?.onConfirm();
      unsubscribeDialogPropsRef.current?.onConfirm();
    });

    expect(deleteFeedMutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(unsubscribeDialogPropsRef.current?.pending).toBe(true);

    await act(async () => {
      resolveDelete();
    });
  });

  it("hides mark same-site feeds item when only one feed exists", () => {
    sameSiteFeedIndexRef.current = new Map([["example.com", { feedIds: [sampleFeeds[0].id], unreadCount: 5 }]]);

    render(<FeedContextMenuContent feed={sampleFeeds[0]} />);

    expect(screen.queryByRole("button", { name: /mark example\.com as read/i })).not.toBeInTheDocument();
  });

  it("hides mark same-site feeds item when same-site feeds have no unread articles", () => {
    const feed = { ...sampleFeeds[0], site_url: "https://example.com", unread_count: 0 };
    sameSiteFeedIndexRef.current = new Map([["example.com", { feedIds: [feed.id, "feed-2"], unreadCount: 0 }]]);

    render(<FeedContextMenuContent feed={feed} />);

    expect(screen.queryByRole("button", { name: /mark example\.com as read/i })).not.toBeInTheDocument();
  });

  it("shows mark same-site feeds item when multiple feeds with unread exist", () => {
    const feed = { ...sampleFeeds[0], site_url: "https://example.com", unread_count: 5 };
    sameSiteFeedIndexRef.current = new Map([["example.com", { feedIds: [feed.id, "feed-2"], unreadCount: 10 }]]);

    render(<FeedContextMenuContent feed={feed} />);

    expect(screen.getByRole("button", { name: /mark example\.com as read/i })).toBeInTheDocument();
  });
});
