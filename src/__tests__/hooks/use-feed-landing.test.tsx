import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useFeedLanding } from "@/hooks/use-feed-landing";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds, setupTauriMocks } from "../../../tests/helpers/tauri-mocks";

describe("useFeedLanding", () => {
  beforeEach(() => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });
    usePreferencesStore.setState({
      prefs: { reader_mode_default: "true", web_preview_mode_default: "false", reading_sort: "newest_first" },
      loaded: true,
    });
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        default:
          return undefined;
      }
    });
  });

  it("lands on the first visible article in reader mode for normal feeds", async () => {
    const { result } = renderHook(() => useFeedLanding(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current("feed-1");
    });

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });
  });

  it("opens browser mode for preview-enabled feeds with a landing URL", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds
            .filter((feed) => feed.account_id === args.accountId)
            .map((feed) => (feed.id === "feed-1" ? { ...feed, reader_mode: "on", web_preview_mode: "on" } : feed));
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        default:
          return undefined;
      }
    });

    const { result } = renderHook(() => useFeedLanding(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current("feed-1");
    });

    await waitFor(() => {
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });
  });

  it("stops at feed selection when the landing list is empty", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return sampleArticles
            .filter((article) => article.feed_id === args.feedId)
            .map((article) => ({ ...article, is_read: true }));
        default:
          return undefined;
      }
    });

    const { result } = renderHook(() => useFeedLanding(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current("feed-1");
    });

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({ type: "feed", feedId: "feed-1" });
      expect(useUiStore.getState().selectedArticleId).toBeNull();
      expect(useUiStore.getState().contentMode).toBe("empty");
    });
  });
});
