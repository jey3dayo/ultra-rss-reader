import { Result } from "@praha/byethrow";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper, createWrapper } from "@tests/helpers/create-wrapper";
import { sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { beforeEach, describe, expect, it } from "vitest";
import { useFeedLanding } from "@/hooks/use-feed-landing";
import { queryKeys } from "@/lib/query/query-invalidation";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

function listAccountFeedsWithLandingMode(accountId: string | undefined) {
  const feeds: (typeof sampleFeeds)[number][] = [];

  for (const feed of sampleFeeds) {
    if (feed.account_id !== accountId) {
      continue;
    }

    feeds.push(feed.id === "feed-1" ? { ...feed, reader_mode: "on", web_preview_mode: "on" } : feed);
  }

  return feeds;
}

function listFeedArticlesWithFirstArticleUrl(feedId: string | undefined, url: string | null) {
  const articles: (typeof sampleArticles)[number][] = [];

  for (const article of sampleArticles) {
    if (article.feed_id !== feedId) {
      continue;
    }

    articles.push(article.id === "art-1" ? { ...article, url } : article);
  }

  return articles;
}

function listReadFeedArticles(feedId: string | undefined) {
  const articles: (typeof sampleArticles)[number][] = [];

  for (const article of sampleArticles) {
    if (article.feed_id === feedId) {
      articles.push({ ...article, is_read: true });
    }
  }

  return articles;
}

describe("useFeedLanding", () => {
  beforeEach(() => {
    useUiStore.setState({
      ...useUiStore.getInitialState(),
      selectedAccountId: "acc-1",
    });
    usePreferencesStore.setState({
      prefs: {
        reader_mode_default: "true",
        web_preview_mode_default: "false",
        reading_sort: "newest_first",
      },
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
    const { result } = renderHook(() => useFeedLanding(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current("feed-1");
    });

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({
        type: "feed",
        feedId: "feed-1",
      });
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });
  });

  it("returns a failure result when no account is selected", async () => {
    useUiStore.setState({ selectedAccountId: null });

    const { result } = renderHook(() => useFeedLanding(), {
      wrapper: createWrapper(),
    });

    let landingResult: Awaited<ReturnType<(typeof result)["current"]>> | undefined;
    await act(async () => {
      landingResult = await result.current("feed-1");
    });

    expect(landingResult).toSatisfy(Result.isFailure);
    expect(Result.unwrapError(landingResult as NonNullable<typeof landingResult>)).toEqual({
      type: "missing_account",
    });
    expect(useUiStore.getState().selection).toEqual({ type: "all" });
  });

  it("returns a failure result when the selected feed is not available", async () => {
    const { result } = renderHook(() => useFeedLanding(), {
      wrapper: createWrapper(),
    });

    let landingResult: Awaited<ReturnType<(typeof result)["current"]>> | undefined;
    await act(async () => {
      landingResult = await result.current("missing-feed");
    });

    expect(landingResult).toSatisfy(Result.isFailure);
    expect(Result.unwrapError(landingResult as NonNullable<typeof landingResult>)).toEqual({
      type: "feed_not_found",
      feedId: "missing-feed",
    });
    expect(useUiStore.getState().selection).toEqual({ type: "all" });
  });

  it("opens browser mode for preview-enabled feeds with a landing URL", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return listAccountFeedsWithLandingMode(args.accountId);
        case "list_articles":
          return sampleArticles.filter((article) => article.feed_id === args.feedId);
        default:
          return undefined;
      }
    });

    const { result } = renderHook(() => useFeedLanding(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current("feed-1");
    });

    await waitFor(() => {
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
      expect(useUiStore.getState().contentMode).toBe("browser");
      expect(useUiStore.getState().browserUrl).toBe("https://example.com/1");
    });
  });

  it("keeps reader mode for preview-enabled feeds when the landing article has no URL", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return listAccountFeedsWithLandingMode(args.accountId);
        case "list_articles":
          return listFeedArticlesWithFirstArticleUrl(args.feedId, null);
        default:
          return undefined;
      }
    });

    const { result } = renderHook(() => useFeedLanding(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current("feed-1");
    });

    await waitFor(() => {
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
      expect(useUiStore.getState().contentMode).toBe("reader");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });
  });

  it("stops at feed selection when the landing list is empty", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return listReadFeedArticles(args.feedId);
        default:
          return undefined;
      }
    });

    const { result } = renderHook(() => useFeedLanding(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current("feed-1");
    });

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({
        type: "feed",
        feedId: "feed-1",
      });
      expect(useUiStore.getState().selectedArticleId).toBeNull();
      expect(useUiStore.getState().contentMode).toBe("empty");
    });
  });

  it("preserves starred context and lands on a starred feed article", async () => {
    useUiStore.setState({
      selection: { type: "smart", kind: "starred" },
      viewMode: "all",
    });
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          return sampleArticles.filter(
            (article) => article.feed_id === args.feedId && (!args.starredOnly || article.is_starred),
          );
        default:
          return undefined;
      }
    });

    const { result } = renderHook(() => useFeedLanding(), {
      wrapper: createWrapper(),
    });

    await act(async () => {
      await result.current("feed-1");
    });

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({
        type: "feed",
        feedId: "feed-1",
      });
      expect(useUiStore.getState().viewMode).toBe("starred");
      expect(useUiStore.getState().selectedArticleId).toBe("art-2");
    });
  });

  it("falls back to cached feed articles when landing fetch fails", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          throw new Error("temporary list failure");
        default:
          return undefined;
      }
    });

    const { queryClient, wrapper } = createQueryWrapper();
    queryClient.setQueryData(
      queryKeys.articles.byFeed("feed-1", "all"),
      sampleArticles.filter((article) => article.feed_id === "feed-1"),
    );

    const { result } = renderHook(() => useFeedLanding(), { wrapper });

    await act(async () => {
      await result.current("feed-1");
    });

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({
        type: "feed",
        feedId: "feed-1",
      });
      expect(useUiStore.getState().selectedArticleId).toBe("art-1");
      expect(useUiStore.getState().browserUrl).toBeNull();
    });
  });

  it("closes the browser and returns a failure result when landing fetch fails without cached articles", async () => {
    setupTauriMocks((cmd, args) => {
      switch (cmd) {
        case "list_feeds":
          return sampleFeeds.filter((feed) => feed.account_id === args.accountId);
        case "list_articles":
          throw new Error("temporary list failure");
        default:
          return undefined;
      }
    });
    useUiStore.setState({
      browserUrl: "https://example.com/open",
      contentMode: "browser",
    });

    const { result } = renderHook(() => useFeedLanding(), {
      wrapper: createWrapper(),
    });

    let landingResult: Awaited<ReturnType<(typeof result)["current"]>> | undefined;
    await act(async () => {
      landingResult = await result.current("feed-1");
    });

    await waitFor(() => {
      expect(useUiStore.getState().selection).toEqual({
        type: "feed",
        feedId: "feed-1",
      });
      expect(useUiStore.getState().selectedArticleId).toBeNull();
      expect(useUiStore.getState().browserUrl).toBeNull();
      expect(useUiStore.getState().contentMode).toBe("empty");
    });
    expect(landingResult).toSatisfy(Result.isFailure);
    expect(Result.unwrapError(landingResult as NonNullable<typeof landingResult>)).toEqual({
      type: "landing_fetch_failed",
      feedId: "feed-1",
      message: "temporary list failure",
    });
  });
});
