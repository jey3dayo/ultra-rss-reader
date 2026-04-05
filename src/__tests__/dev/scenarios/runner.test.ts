import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountDto, ArticleDto, FeedDto, TagDto } from "@/api/tauri-commands";
import { runDevScenario } from "@/dev/scenarios/runner";
import type { DevScenarioContext } from "@/dev/scenarios/types";
import { usePreferencesStore } from "@/stores/preferences-store";

type QueryKey = readonly unknown[];

function createQueryClientStub() {
  const cache = new Map<string, unknown>();

  const getQueryData: DevScenarioContext["queryClient"]["getQueryData"] = (key) =>
    cache.get(JSON.stringify(key as QueryKey)) as never;
  const setQueryData: DevScenarioContext["queryClient"]["setQueryData"] = (key, updater) => {
    const serializedKey = JSON.stringify(key as QueryKey);
    const previousValue = cache.get(serializedKey);
    const nextValue = typeof updater === "function" ? (updater as (value: unknown) => unknown)(previousValue) : updater;
    cache.set(serializedKey, nextValue);
    return nextValue as never;
  };

  const queryClient: DevScenarioContext["queryClient"] = {
    getQueryData,
    setQueryData,
  };

  return { cache, queryClient };
}

function createUiStub(overrides?: Record<string, unknown>): DevScenarioContext["ui"] {
  return {
    selectedAccountId: null,
    showToast: vi.fn(),
    selectAccount: vi.fn(),
    selectFeed: vi.fn(),
    selectFolder: vi.fn(),
    selectSmartView: vi.fn(),
    selectTag: vi.fn(),
    selectAll: vi.fn(),
    selectArticle: vi.fn(),
    openBrowser: vi.fn(),
    setViewMode: vi.fn(),
    openSettings: vi.fn(),
    openAddFeedDialog: vi.fn(),
    openCommandPalette: vi.fn(),
    closeCommandPalette: vi.fn(),
    toggleCommandPalette: vi.fn(),
    ...overrides,
  } as unknown as DevScenarioContext["ui"];
}

function createActions(overrides?: Partial<DevScenarioContext["actions"]>): DevScenarioContext["actions"] {
  return {
    executeAction: vi.fn(),
    listAccounts: vi.fn(async () => []),
    listFeeds: vi.fn(async () => []),
    listArticles: vi.fn(async () => []),
    listTags: vi.fn(async () => []),
    getTagArticleCounts: vi.fn(async () => ({})),
    listArticlesByTag: vi.fn(async () => []),
    ...overrides,
  };
}

function createContext(overrides?: Partial<DevScenarioContext>): DevScenarioContext {
  const { queryClient } = createQueryClientStub();

  return {
    ui: createUiStub(),
    queryClient,
    actions: createActions(),
    ...overrides,
  };
}

const account: AccountDto = {
  id: "acc-1",
  name: "Main",
  kind: "FreshRSS",
  server_url: "https://example.com",
  username: "reader",
  sync_interval_secs: 300,
  sync_on_wake: true,
  keep_read_items_days: 30,
};

const genericFeed: FeedDto = {
  id: "feed-1",
  account_id: account.id,
  folder_id: null,
  title: "Tech",
  url: "https://example.com/feed.xml",
  site_url: "https://example.com",
  unread_count: 10,
  reader_mode: "off",
  web_preview_mode: "off",
};

const mangaFeed: FeedDto = {
  id: "feed-2",
  account_id: account.id,
  folder_id: null,
  title: "マガポケ",
  url: "https://pocket.shonenmagazine.com/feed",
  site_url: "https://pocket.shonenmagazine.com",
  unread_count: 2,
  reader_mode: "on",
  web_preview_mode: "on",
};

const readArticle: ArticleDto = {
  id: "article-1",
  feed_id: mangaFeed.id,
  title: "Read article",
  content_sanitized: "<p>done</p>",
  summary: "done",
  url: "https://example.com/read",
  author: null,
  published_at: "2026-04-03T00:00:00.000Z",
  thumbnail: null,
  is_read: true,
  is_starred: false,
};

const unreadArticle: ArticleDto = {
  id: "article-2",
  feed_id: mangaFeed.id,
  title: "Unread article",
  content_sanitized: "<p>new</p>",
  summary: "new",
  url: "https://example.com/unread",
  author: null,
  published_at: "2026-04-03T00:00:00.000Z",
  thumbnail: "https://example.com/thumb.png",
  is_read: false,
  is_starred: false,
};

const otherAccount: AccountDto = {
  ...account,
  id: "acc-2",
  name: "Backup",
};

const otherFeed: FeedDto = {
  ...genericFeed,
  id: "feed-3",
  account_id: otherAccount.id,
  title: "Misc",
};

const landingNewestArticle: ArticleDto = {
  ...unreadArticle,
  id: "article-3",
  title: "Newest unread article",
  published_at: "2026-04-04T00:00:00.000Z",
  thumbnail: null,
};

const overlayPreferredOlderArticle: ArticleDto = {
  ...unreadArticle,
  id: "article-4",
  title: "Older unread with thumbnail",
  published_at: "2026-04-02T00:00:00.000Z",
  thumbnail: "https://example.com/older-thumb.png",
};

const primaryTag: TagDto = {
  id: "tag-1",
  name: "Important",
  color: "#ff0000",
};

const secondaryTag: TagDto = {
  id: "tag-2",
  name: "Later",
  color: "#00ff00",
};

describe("runDevScenario", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    usePreferencesStore.setState({ prefs: {}, loaded: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("hydrates the image viewer overlay with the shared scenario flow", async () => {
    const { cache, queryClient } = createQueryClientStub();
    const ui = createUiStub();
    const context: DevScenarioContext = {
      ui,
      queryClient,
      actions: createActions({
        executeAction: vi.fn(),
        listAccounts: vi.fn(async () => [account]),
        listFeeds: vi.fn(async () => [genericFeed, mangaFeed]),
        listArticles: vi.fn(async (feedId: string) => {
          if (feedId === genericFeed.id) {
            return [];
          }

          return [readArticle, unreadArticle];
        }),
      }),
    };

    await runDevScenario("image-viewer-overlay", { context });
    await vi.runAllTimersAsync();

    expect(context.actions.listAccounts).toHaveBeenCalledTimes(1);
    expect(context.actions.listFeeds).toHaveBeenCalledWith(account.id);
    expect(context.actions.listArticles).toHaveBeenCalledTimes(1);
    expect(context.actions.listArticles).toHaveBeenCalledWith(mangaFeed.id);
    expect(cache.get(JSON.stringify(["accounts"]))).toEqual([account]);
    expect(cache.get(JSON.stringify(["articles", mangaFeed.id]))).toEqual([readArticle, unreadArticle]);
    expect(cache.get(JSON.stringify(["feeds", account.id]))).toEqual([
      genericFeed,
      { ...mangaFeed, reader_mode: "on", web_preview_mode: "on" },
    ]);
    expect(ui.selectAccount).toHaveBeenCalledTimes(3);
    expect(ui.selectAccount).toHaveBeenNthCalledWith(1, account.id);
    expect(ui.selectFeed).toHaveBeenCalledTimes(3);
    expect(ui.selectFeed).toHaveBeenNthCalledWith(1, mangaFeed.id);
    expect(ui.setViewMode).toHaveBeenCalledTimes(3);
    expect(ui.setViewMode).toHaveBeenNthCalledWith(1, "all");
    expect(ui.selectArticle).toHaveBeenCalledTimes(3);
    expect(ui.selectArticle).toHaveBeenNthCalledWith(1, unreadArticle.id);
    expect(ui.openBrowser).toHaveBeenCalledTimes(3);
    expect(ui.openBrowser).toHaveBeenNthCalledWith(1, "http://localhost:3000/dev-image-viewer.html");
    expect(ui.showToast).not.toHaveBeenCalled();
  });

  it("shows the existing empty-account toast when the overlay cannot find an account", async () => {
    const context = createContext();

    await runDevScenario("image-viewer-overlay", { context });

    expect(context.ui.showToast).toHaveBeenCalledWith("Dev intent could not find any accounts.");
  });

  it("shows the overlay failure toast when hydration throws", async () => {
    const context = createContext({
      actions: createActions({
        executeAction: vi.fn(),
        listAccounts: vi.fn(async () => {
          throw new Error("boom");
        }),
        listFeeds: vi.fn(async () => []),
        listArticles: vi.fn(async () => []),
      }),
    });

    await runDevScenario("image-viewer-overlay", { context });

    expect(context.ui.showToast).toHaveBeenCalledWith("Dev intent failed to open the overlay.");
  });

  it("opens the feed landing article in reader mode", async () => {
    const { cache, queryClient } = createQueryClientStub();
    const ui = createUiStub();
    const context: DevScenarioContext = {
      ui,
      queryClient,
      actions: createActions({
        executeAction: vi.fn(),
        listAccounts: vi.fn(async () => [otherAccount, account]),
        listFeeds: vi.fn(async (accountId: string) => {
          if (accountId === otherAccount.id) {
            return [otherFeed];
          }

          return [genericFeed, mangaFeed];
        }),
        listArticles: vi.fn(async (feedId: string) => {
          if (feedId === otherFeed.id || feedId === genericFeed.id) {
            return [];
          }

          return [overlayPreferredOlderArticle, landingNewestArticle, readArticle];
        }),
      }),
    };

    await runDevScenario("open-feed-first-article", { context });

    expect(context.actions.listAccounts).toHaveBeenCalledTimes(1);
    expect(context.actions.listFeeds).toHaveBeenCalledTimes(2);
    expect(context.actions.listFeeds).toHaveBeenNthCalledWith(1, otherAccount.id);
    expect(context.actions.listFeeds).toHaveBeenNthCalledWith(2, account.id);
    expect(context.actions.listArticles).toHaveBeenCalledTimes(2);
    expect(context.actions.listArticles).toHaveBeenNthCalledWith(1, otherFeed.id);
    expect(context.actions.listArticles).toHaveBeenNthCalledWith(2, mangaFeed.id);
    expect(cache.get(JSON.stringify(["accounts"]))).toEqual([otherAccount, account]);
    expect(cache.get(JSON.stringify(["feeds", account.id]))).toEqual([
      genericFeed,
      { ...mangaFeed, reader_mode: "on", web_preview_mode: "off" },
    ]);
    expect(cache.get(JSON.stringify(["articles", mangaFeed.id]))).toEqual([
      overlayPreferredOlderArticle,
      landingNewestArticle,
      readArticle,
    ]);
    expect(ui.selectAccount).toHaveBeenCalledWith(account.id);
    expect(ui.selectFeed).toHaveBeenCalledWith(mangaFeed.id);
    expect(ui.setViewMode).toHaveBeenCalledWith("all");
    expect(ui.selectArticle).toHaveBeenCalledWith(landingNewestArticle.id);
    expect(ui.openBrowser).not.toHaveBeenCalled();
    expect(ui.showToast).not.toHaveBeenCalled();
  });

  it("continues searching until a ranked feed has a usable landing article", async () => {
    const { cache, queryClient } = createQueryClientStub();
    const ui = createUiStub();
    const blockedRankedFeed: FeedDto = {
      ...genericFeed,
      id: "feed-blocked",
      title: "マガポケ comic manga blocked",
      url: "https://example.com/magapoke-comic-manga.xml",
      site_url: "https://example.com/manga",
      unread_count: 99,
    };
    const blockedReadArticle: ArticleDto = {
      ...readArticle,
      id: "article-blocked",
      feed_id: blockedRankedFeed.id,
      published_at: "2026-04-05T00:00:00.000Z",
    };
    const context: DevScenarioContext = {
      ui,
      queryClient,
      actions: createActions({
        executeAction: vi.fn(),
        listAccounts: vi.fn(async () => [account]),
        listFeeds: vi.fn(async () => [blockedRankedFeed, mangaFeed]),
        listArticles: vi.fn(async (feedId: string) => {
          if (feedId === blockedRankedFeed.id) {
            return [blockedReadArticle];
          }

          return [overlayPreferredOlderArticle, landingNewestArticle, readArticle];
        }),
      }),
    };

    await runDevScenario("open-feed-first-article", { context });

    expect(context.actions.listArticles).toHaveBeenCalledTimes(2);
    expect(context.actions.listArticles).toHaveBeenNthCalledWith(1, blockedRankedFeed.id);
    expect(context.actions.listArticles).toHaveBeenNthCalledWith(2, mangaFeed.id);
    expect(cache.get(JSON.stringify(["articles", blockedRankedFeed.id]))).toEqual([blockedReadArticle]);
    expect(cache.get(JSON.stringify(["articles", mangaFeed.id]))).toEqual([
      overlayPreferredOlderArticle,
      landingNewestArticle,
      readArticle,
    ]);
    expect(cache.get(JSON.stringify(["feeds", account.id]))).toEqual([
      blockedRankedFeed,
      { ...mangaFeed, reader_mode: "on", web_preview_mode: "off" },
    ]);
    expect(ui.selectFeed).toHaveBeenCalledWith(mangaFeed.id);
    expect(ui.selectArticle).toHaveBeenCalledWith(landingNewestArticle.id);
    expect(ui.showToast).not.toHaveBeenCalled();
  });

  it("shows an explicit toast when the feed-first-article scenario cannot find any articles", async () => {
    const context = createContext({
      actions: createActions({
        executeAction: vi.fn(),
        listAccounts: vi.fn(async () => [account]),
        listFeeds: vi.fn(async () => [genericFeed]),
        listArticles: vi.fn(async () => []),
      }),
    });

    await runDevScenario("open-feed-first-article", { context });

    expect(context.ui.showToast).toHaveBeenCalledWith(
      'Dev scenario "open-feed-first-article" could not find any articles.',
    );
  });

  it("shows an explicit toast when the feed-first-article scenario cannot find any accounts", async () => {
    const context = createContext();

    await runDevScenario("open-feed-first-article", { context });

    expect(context.ui.showToast).toHaveBeenCalledWith(
      'Dev scenario "open-feed-first-article" could not find any accounts.',
    );
  });

  it("reproduces tag navigation state for the currently selected account without opening an article", async () => {
    const { cache, queryClient } = createQueryClientStub();
    const ui = createUiStub({ selectedAccountId: otherAccount.id });
    const context: DevScenarioContext = {
      ui,
      queryClient,
      actions: createActions({
        executeAction: vi.fn(),
        listAccounts: vi.fn(async () => [account, otherAccount]),
        listFeeds: vi.fn(async () => []),
        listArticles: vi.fn(async () => []),
        listTags: vi.fn(async () => [primaryTag, secondaryTag]),
        getTagArticleCounts: vi.fn(async (accountId?: string) => {
          if (accountId === otherAccount.id) {
            return { [secondaryTag.id]: 2 };
          }

          return { [primaryTag.id]: 1 };
        }),
        listArticlesByTag: vi.fn(async (tagId: string, _offset?: number, _limit?: number, accountId?: string) => {
          if (tagId === secondaryTag.id && accountId === otherAccount.id) {
            return [landingNewestArticle, readArticle];
          }

          if (tagId === primaryTag.id && accountId === account.id) {
            return [overlayPreferredOlderArticle];
          }

          return [];
        }),
      }),
    };

    await runDevScenario("open-tag-view", { context });

    expect(context.actions.listAccounts).toHaveBeenCalledTimes(1);
    expect(context.actions.listTags).toHaveBeenCalledTimes(1);
    expect(context.actions.getTagArticleCounts).toHaveBeenCalledWith(otherAccount.id);
    expect(context.actions.listArticlesByTag).toHaveBeenCalledWith(
      secondaryTag.id,
      undefined,
      undefined,
      otherAccount.id,
    );
    expect(cache.get(JSON.stringify(["accounts"]))).toEqual([account, otherAccount]);
    expect(cache.get(JSON.stringify(["tags"]))).toEqual([primaryTag, secondaryTag]);
    expect(cache.get(JSON.stringify(["tagArticleCounts", otherAccount.id]))).toEqual({ [secondaryTag.id]: 2 });
    expect(cache.get(JSON.stringify(["articlesByTag", secondaryTag.id, otherAccount.id]))).toEqual([
      landingNewestArticle,
      readArticle,
    ]);
    expect(ui.selectAccount).not.toHaveBeenCalled();
    expect(ui.selectTag).toHaveBeenCalledWith(secondaryTag.id);
    expect(ui.setViewMode).toHaveBeenCalledWith("all");
    expect(ui.selectArticle).not.toHaveBeenCalled();
    expect(ui.showToast).not.toHaveBeenCalled();
  });

  it("falls back to the first account for tag view when no account is selected", async () => {
    const { cache, queryClient } = createQueryClientStub();
    const ui = createUiStub({ selectedAccountId: null });
    const context: DevScenarioContext = {
      ui,
      queryClient,
      actions: createActions({
        executeAction: vi.fn(),
        listAccounts: vi.fn(async () => [account, otherAccount]),
        listFeeds: vi.fn(async () => []),
        listArticles: vi.fn(async () => []),
        listTags: vi.fn(async () => [primaryTag]),
        getTagArticleCounts: vi.fn(async () => ({ [primaryTag.id]: 1 })),
        listArticlesByTag: vi.fn(async () => [landingNewestArticle]),
      }),
    };

    await runDevScenario("open-tag-view", { context });

    expect(context.actions.getTagArticleCounts).toHaveBeenCalledWith(account.id);
    expect(context.actions.listArticlesByTag).toHaveBeenCalledWith(primaryTag.id, undefined, undefined, account.id);
    expect(cache.get(JSON.stringify(["tagArticleCounts", account.id]))).toEqual({ [primaryTag.id]: 1 });
    expect(cache.get(JSON.stringify(["articlesByTag", primaryTag.id, account.id]))).toEqual([landingNewestArticle]);
    expect(ui.selectAccount).toHaveBeenCalledWith(account.id);
    expect(ui.selectTag).toHaveBeenCalledWith(primaryTag.id);
    expect(ui.selectArticle).not.toHaveBeenCalled();
  });

  it("shows an explicit toast when the tag-view scenario cannot find any accounts", async () => {
    const context = createContext();

    await runDevScenario("open-tag-view", { context });

    expect(context.ui.showToast).toHaveBeenCalledWith('Dev scenario "open-tag-view" could not find any accounts.');
  });

  it("shows an explicit toast when the tag-view scenario cannot find any articles", async () => {
    const context = createContext({
      actions: createActions({
        executeAction: vi.fn(),
        listAccounts: vi.fn(async () => [account]),
        listFeeds: vi.fn(async () => []),
        listArticles: vi.fn(async () => []),
        listTags: vi.fn(async () => [primaryTag]),
        getTagArticleCounts: vi.fn(async () => ({ [primaryTag.id]: 0 })),
        listArticlesByTag: vi.fn(async () => []),
      }),
    });

    await runDevScenario("open-tag-view", { context });

    expect(context.ui.showToast).toHaveBeenCalledWith('Dev scenario "open-tag-view" could not find any articles.');
  });

  it("runs the add-feed dialog scenario through the app action dispatcher", async () => {
    const context = createContext({
      actions: createActions({
        executeAction: vi.fn(),
      }),
    });

    await runDevScenario("open-add-feed-dialog", { context });

    expect(context.actions.executeAction).toHaveBeenCalledWith("open-add-feed");
    expect(context.ui.showToast).not.toHaveBeenCalled();
  });

  it("runs the feed-cleanup scenario through the app action dispatcher", async () => {
    const context = createContext({
      actions: createActions({
        executeAction: vi.fn(),
      }),
    });

    await runDevScenario("open-feed-cleanup", { context });

    expect(context.actions.executeAction).toHaveBeenCalledWith("open-feed-cleanup");
    expect(context.ui.showToast).not.toHaveBeenCalled();
  });

  it("runs the broken-references feed-cleanup scenario through the app action dispatcher", async () => {
    const context = createContext({
      actions: createActions({
        executeAction: vi.fn(),
      }),
    });

    await runDevScenario("open-feed-cleanup-broken-references", { context });

    expect(context.actions.executeAction).toHaveBeenCalledWith("open-feed-cleanup");
    expect(context.ui.showToast).not.toHaveBeenCalled();
  });

  it("opens settings at the reading section for the settings-reading scenario", async () => {
    const context = createContext({
      actions: createActions({
        executeAction: vi.fn(),
      }),
    });

    await runDevScenario("open-settings-reading", { context });

    expect(context.ui.openSettings).toHaveBeenCalledWith("reading");
    expect(context.actions.executeAction).not.toHaveBeenCalled();
    expect(context.ui.showToast).not.toHaveBeenCalled();
  });

  it("opens settings at the reading section for the display-mode showcase scenario", async () => {
    const context = createContext({
      actions: createActions({
        executeAction: vi.fn(),
      }),
    });

    await runDevScenario("open-settings-reading-display-mode", { context });

    expect(context.ui.openSettings).toHaveBeenCalledWith("reading");
    expect(context.actions.executeAction).not.toHaveBeenCalled();
    expect(context.ui.showToast).not.toHaveBeenCalled();
  });

  it("runs the sync-all smoke scenario through the app action dispatcher", async () => {
    const context = createContext({
      actions: createActions({
        executeAction: vi.fn(),
      }),
    });

    await runDevScenario("sync-all-smoke", { context });

    expect(context.actions.executeAction).toHaveBeenCalledWith("sync-all");
    expect(context.ui.showToast).not.toHaveBeenCalled();
  });
});
