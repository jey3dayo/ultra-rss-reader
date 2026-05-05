import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedContextMenuContent } from "@/components/reader/feed-context-menu";
import { usePreferencesStore } from "@/stores/preferences-store";
import { type MockTauriCommandCall, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

vi.mock("@/components/reader/feed-context-menu-view", () => ({
  FeedContextMenuView: ({ openSiteLabel, onOpenSite }: { openSiteLabel: string; onOpenSite: () => void }) => (
    <button type="button" onClick={onOpenSite}>
      {openSiteLabel}
    </button>
  ),
}));

vi.mock("@/components/reader/rename-feed-dialog", () => ({
  RenameDialog: () => null,
}));

vi.mock("@/components/reader/unsubscribe-feed-dialog", () => ({
  UnsubscribeDialog: () => null,
}));

vi.mock("@/hooks/use-articles", () => ({
  useMarkFeedRead: () => ({ mutate: vi.fn() }),
  useMarkOldUnreadRead: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/hooks/use-confirm-mark-all-read", () => ({
  useConfirmMarkAllRead: () => vi.fn(),
}));

vi.mock("@/hooks/use-delete-feed", () => ({
  useDeleteFeed: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/hooks/use-update-feed-display-mode", () => ({
  useUpdateFeedDisplaySettings: () => vi.fn(),
}));

describe("FeedContextMenuContent", () => {
  let calls: MockTauriCommandCall[] = [];

  beforeEach(() => {
    calls = [];
    usePreferencesStore.setState({ prefs: {}, loaded: true });
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

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(calls).toContainEqual({
        cmd: "open_in_browser",
        args: { url: "https://example.com", background: true },
      });
    });
  });
});
