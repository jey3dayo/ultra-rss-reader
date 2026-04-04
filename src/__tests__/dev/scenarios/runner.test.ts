import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountDto, ArticleDto, FeedDto } from "@/api/tauri-commands";
import { runDevScenario } from "@/dev/scenarios/runner";
import type { DevScenarioContext } from "@/dev/scenarios/types";

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

function createUiStub(): DevScenarioContext["ui"] {
  return {
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
    openAddFeedDialog: vi.fn(),
    openCommandPalette: vi.fn(),
    closeCommandPalette: vi.fn(),
    toggleCommandPalette: vi.fn(),
  };
}

function createContext(overrides?: Partial<DevScenarioContext>): DevScenarioContext {
  const { queryClient } = createQueryClientStub();

  return {
    ui: createUiStub(),
    queryClient,
    actions: {
      executeAction: vi.fn(),
      listAccounts: vi.fn(async () => []),
      listFeeds: vi.fn(async () => []),
      listArticles: vi.fn(async () => []),
    },
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

describe("runDevScenario", () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
      actions: {
        executeAction: vi.fn(),
        listAccounts: vi.fn(async () => [account]),
        listFeeds: vi.fn(async () => [genericFeed, mangaFeed]),
        listArticles: vi.fn(async (feedId: string) => {
          if (feedId === genericFeed.id) {
            return [];
          }

          return [readArticle, unreadArticle];
        }),
      },
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
      actions: {
        executeAction: vi.fn(),
        listAccounts: vi.fn(async () => {
          throw new Error("boom");
        }),
        listFeeds: vi.fn(async () => []),
        listArticles: vi.fn(async () => []),
      },
    });

    await runDevScenario("image-viewer-overlay", { context });

    expect(context.ui.showToast).toHaveBeenCalledWith("Dev intent failed to open the overlay.");
  });

  it("surfaces an explicit toast for registered scenarios that are still stubbed", async () => {
    const context = createContext();

    await runDevScenario("open-add-feed-dialog", { context });

    expect(context.ui.showToast).toHaveBeenCalledWith('Dev scenario "open-add-feed-dialog" is not implemented yet.');
  });
});
