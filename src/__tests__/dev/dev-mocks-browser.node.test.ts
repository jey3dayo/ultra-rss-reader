import { Result } from "@praha/byethrow";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { clearMocks } from "@tauri-apps/api/mocks";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AccountDtoListSchema,
  AccountDtoSchema,
  AccountSyncStatusSchema,
  ArticleDtoListSchema,
  BrowserWebviewStateSchema,
  CountResponseSchema,
  DatabaseInfoDtoSchema,
  DevRuntimeOptionsSchema,
  DiscoveredFeedDtoListSchema,
  FeedArticleSummaryDtoListSchema,
  FeedDtoListSchema,
  FeedDtoSchema,
  FeedIntegrityCleanupDtoSchema,
  FeedIntegrityReportDtoSchema,
  FolderDtoListSchema,
  FolderDtoSchema,
  MuteKeywordDtoListSchema,
  MuteKeywordDtoSchema,
  PlatformInfoSchema,
  PreferencesDtoSchema,
  StringResponseSchema,
  SyncResultSchema,
  TagArticleCountsSchema,
  TagDtoListSchema,
  TagDtoSchema,
} from "@/api/schemas";
import {
  addLocalFeed,
  addToReadingList,
  checkBrowserEmbedSupport,
  cleanupFeedIntegrityOrphans,
  clearArticleViewHistory,
  countAccountStarredArticles,
  countAccountUnreadArticles,
  countOldUnreadArticles,
  createFolder,
  createMuteKeyword,
  createOrUpdateBrowserWebview,
  createTag,
  deleteAccount,
  deleteFeed,
  deleteTag,
  discoverFeeds,
  exportOpml,
  getAccountSyncStatus,
  getArticleTags,
  getDatabaseInfo,
  getDevRuntimeOptions,
  getFeedIntegrityReport,
  getPlatformInfo,
  getPreferences,
  getTagArticleCounts,
  goBackBrowserWebview,
  goForwardBrowserWebview,
  importOpml,
  listAccountArticles,
  listAccounts,
  listArticles,
  listArticlesByTag,
  listFeedArticleSummaries,
  listFeeds,
  listFolders,
  listMuteKeywords,
  listRecentArticles,
  listStarredArticles,
  listTags,
  markArticleRead,
  markOldUnreadRead,
  openExternalUrl,
  openInBrowser,
  recordArticleView,
  reloadBrowserWebview,
  searchArticles,
  setPreference,
  syncAccount,
  syncFeed,
  testAccountConnection,
  triggerAutomaticSync,
  triggerStartupSync,
  triggerSync,
  updateAccountCredentials,
  updateFeedFolder,
  vacuumDatabase,
} from "@/api/tauri-commands";
import { DEFAULT_PLATFORM_INFO } from "@/constants/platform";
import { mockArticles } from "@/dev/mock-data";
import { setupDevMocks } from "@/dev/mocks";
import type { BrowserWebviewBounds } from "@/lib/browser/browser-webview";

type DevMockDiagnosticsTestWindow = Window & {
  __ULTRA_RSS_DEV_MOCK_DIAGNOSTICS__?: Array<{
    kind: "unknown-command";
    command: string;
    message: string;
  }>;
};
type DevMockExternalOpenerTestWindow = Window & {
  __ULTRA_RSS_DEV_MOCK_EXTERNAL_OPENS__?: Array<{
    command: "open_in_browser" | "plugin:opener|open_url" | "add_to_reading_list";
    url: string;
    target: "_blank" | "reading-list";
  }>;
};

setupBrowserTestDom();

describe("setupDevMocks", () => {
  const browserBounds: BrowserWebviewBounds = {
    x: 380,
    y: 48,
    width: 900,
    height: 720,
  };

  beforeEach(() => {
    clearMocks();
    delete window.__TAURI_INTERNALS__;
    delete window.__DEV_BROWSER_MOCKS__;
    delete window.__ULTRA_RSS_BROWSER_MOCKS__;
    delete (window as DevMockDiagnosticsTestWindow).__ULTRA_RSS_DEV_MOCK_DIAGNOSTICS__;
    delete (window as DevMockExternalOpenerTestWindow).__ULTRA_RSS_DEV_MOCK_EXTERNAL_OPENS__;
    document.getElementById("ultra-rss-dev-mock-diagnostics")?.remove();
  });

  afterEach(() => {
    clearMocks();
    delete window.__TAURI_INTERNALS__;
    delete window.__DEV_BROWSER_MOCKS__;
    delete window.__ULTRA_RSS_BROWSER_MOCKS__;
    delete (window as DevMockDiagnosticsTestWindow).__ULTRA_RSS_DEV_MOCK_DIAGNOSTICS__;
    delete (window as DevMockExternalOpenerTestWindow).__ULTRA_RSS_DEV_MOCK_EXTERNAL_OPENS__;
    document.getElementById("ultra-rss-dev-mock-diagnostics")?.remove();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("installs and restores browser-only mock window globals", () => {
    const restoreDevMocks = setupDevMocks();

    expect(window.__DEV_BROWSER_MOCKS__).toBe(true);
    expect(window.__ULTRA_RSS_BROWSER_MOCKS__).toBe(true);
    expect(Object.getOwnPropertyDescriptor(window, "__DEV_BROWSER_MOCKS__")).toMatchObject({
      configurable: true,
      writable: true,
      value: true,
    });
    expect(Object.getOwnPropertyDescriptor(window, "__ULTRA_RSS_BROWSER_MOCKS__")).toMatchObject({
      configurable: true,
      writable: true,
      value: true,
    });

    restoreDevMocks();

    expect(Object.getOwnPropertyDescriptor(window, "__DEV_BROWSER_MOCKS__")).toBeUndefined();
    expect(Object.getOwnPropertyDescriptor(window, "__ULTRA_RSS_BROWSER_MOCKS__")).toBeUndefined();
  });

  it("restores previous browser-only mock window global descriptors", () => {
    Object.defineProperty(window, "__DEV_BROWSER_MOCKS__", {
      configurable: true,
      writable: false,
      value: false,
    });
    Object.defineProperty(window, "__ULTRA_RSS_BROWSER_MOCKS__", {
      configurable: true,
      writable: false,
      value: true,
    });

    const restoreDevMocks = setupDevMocks();

    expect(window.__DEV_BROWSER_MOCKS__).toBe(true);
    expect(window.__ULTRA_RSS_BROWSER_MOCKS__).toBe(true);

    restoreDevMocks();

    expect(Object.getOwnPropertyDescriptor(window, "__DEV_BROWSER_MOCKS__")).toMatchObject({
      configurable: true,
      writable: false,
      value: false,
    });
    expect(Object.getOwnPropertyDescriptor(window, "__ULTRA_RSS_BROWSER_MOCKS__")).toMatchObject({
      configurable: true,
      writable: false,
      value: true,
    });
  });

  it("does not install browser-only mock globals when Tauri is already installed", () => {
    setTauriRuntimePresent();

    const restoreDevMocks = setupDevMocks();

    expect(window.__DEV_BROWSER_MOCKS__).toBe(false);
    expect(window.__ULTRA_RSS_BROWSER_MOCKS__).toBe(false);

    restoreDevMocks();

    expect(window.__TAURI_INTERNALS__).toEqual({});
    expect(window.__DEV_BROWSER_MOCKS__).toBe(false);
    expect(window.__ULTRA_RSS_BROWSER_MOCKS__).toBe(false);
  });

  it("does not install browser-only mock globals for partial Tauri internals without invoke", () => {
    setTauriRuntimePresent();

    const restoreDevMocks = setupDevMocks();

    expect(window.__TAURI_INTERNALS__).toEqual({});
    expect(window.__DEV_BROWSER_MOCKS__).toBe(false);
    expect(window.__ULTRA_RSS_BROWSER_MOCKS__).toBe(false);

    restoreDevMocks();

    expect(window.__DEV_BROWSER_MOCKS__).toBe(false);
    expect(window.__ULTRA_RSS_BROWSER_MOCKS__).toBe(false);
  });

  it("returns a settled browser state for browser-only UI checks", async () => {
    setupDevMocks();

    const result = await createOrUpdateBrowserWebview("https://example.com/article", browserBounds);
    const state = Result.unwrap(result);

    expect(state).toEqual({
      url: "https://example.com/article",
      can_go_back: false,
      can_go_forward: false,
      is_loading: false,
      load_generation: 1,
    });
  });

  it("returns an empty feed integrity report for browser-only subscription checks", async () => {
    setupDevMocks();

    const result = await getFeedIntegrityReport();
    const report = Result.unwrap(result);

    expect(FeedIntegrityReportDtoSchema.parse(report)).toEqual(report);
    expect(report).toEqual({
      orphaned_article_count: 0,
      orphaned_feeds: [],
    });
  });

  it("returns dev runtime options instead of null in browser-only mode", async () => {
    setupDevMocks();

    const result = await getDevRuntimeOptions();
    const options = Result.unwrap(result);

    expect(options).toEqual({
      dev_intent: null,
      dev_web_url: null,
      dev_window_width: null,
      dev_window_height: null,
    });
  });

  it("reports an unknown platform in browser-only preview mode", async () => {
    setupDevMocks();

    const result = await getPlatformInfo();
    const platform = Result.unwrap(result);

    expect(platform).toEqual(DEFAULT_PLATFORM_INFO);
  });

  it("returns account sync status for browser-only account settings checks", async () => {
    setupDevMocks();

    const result = await getAccountSyncStatus("acc-freshrss");
    const status = Result.unwrap(result);

    expect(status).toEqual({
      last_success_at: null,
      last_error: null,
      error_count: 0,
      next_retry_at: null,
    });
  });

  it("surfaces browser-only sync status failures for unknown, deleted, and local accounts", async () => {
    setupDevMocks();

    const unknown = Result.unwrap(await getAccountSyncStatus("acc-missing"));
    const local = Result.unwrap(await getAccountSyncStatus("acc-local"));
    Result.unwrap(await deleteAccount("acc-freshrss"));
    const deleted = Result.unwrap(await getAccountSyncStatus("acc-freshrss"));

    expect(unknown).toMatchObject({
      last_success_at: null,
      last_error: "Account not found: acc-missing",
      error_count: 1,
      next_retry_at: null,
    });
    expect(local).toMatchObject({
      last_success_at: null,
      last_error: "Sync is unavailable for local accounts",
      error_count: 1,
      next_retry_at: null,
    });
    expect(deleted).toMatchObject({
      last_success_at: null,
      last_error: "Account not found: acc-freshrss",
      error_count: 1,
      next_retry_at: null,
    });
    expect(AccountSyncStatusSchema.parse(unknown)).toEqual(unknown);
    expect(AccountSyncStatusSchema.parse(local)).toEqual(local);
    expect(AccountSyncStatusSchema.parse(deleted)).toEqual(deleted);
  });

  it("regenerates browser-only today and yesterday article dates when mock state resets", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-10T03:00:00.000Z"));
    setupDevMocks();

    const firstArticles = Result.unwrap(await listArticles("feed-automaton", 0, 10));
    const firstTodayArticle = firstArticles.find((article) => article.id === "art-1");
    const firstYesterdayArticle = firstArticles.find((article) => article.id === "art-3");

    vi.setSystemTime(new Date("2026-05-12T03:00:00.000Z"));
    setupDevMocks();

    const nextArticles = Result.unwrap(await listArticles("feed-automaton", 0, 10));
    const nextTodayArticle = nextArticles.find((article) => article.id === "art-1");
    const nextYesterdayArticle = nextArticles.find((article) => article.id === "art-3");

    expect(firstTodayArticle?.published_at).toMatch(/^2026-05-10T/);
    expect(firstYesterdayArticle?.published_at).toMatch(/^2026-05-09T/);
    expect(nextTodayArticle?.published_at).toMatch(/^2026-05-12T/);
    expect(nextYesterdayArticle?.published_at).toMatch(/^2026-05-11T/);
  });

  it("returns cloned DTO lists so mock mutations do not alter cached responses", async () => {
    setupDevMocks();

    const accounts = Result.unwrap(await listAccounts());
    const feeds = Result.unwrap(await listFeeds("acc-freshrss"));
    const tags = Result.unwrap(await listTags());
    const articles = Result.unwrap(await listArticles("feed-automaton", 0, 10));
    const firstArticle = articles[0];

    expect(firstArticle).toBeDefined();
    if (!firstArticle) return;

    const accountSnapshot = structuredClone(accounts);
    const feedSnapshot = structuredClone(feeds);
    const tagSnapshot = structuredClone(tags);
    const articleSnapshot = structuredClone(articles);

    Result.unwrap(await updateAccountCredentials("acc-freshrss", "https://reader.example.com", "demo-user", "secret"));
    Result.unwrap(await createTag("stateful"));
    Result.unwrap(await markArticleRead(firstArticle.id, true));

    expect(accounts).toEqual(accountSnapshot);
    expect(feeds).toEqual(feedSnapshot);
    expect(tags).toEqual(tagSnapshot);
    expect(articles).toEqual(articleSnapshot);

    const nextArticles = Result.unwrap(await listArticles("feed-automaton", 0, 10));
    expect(nextArticles.find((article) => article.id === firstArticle.id)?.is_read).toBe(true);
    expect(articles.find((article) => article.id === firstArticle.id)?.is_read).toBe(firstArticle.is_read);
  });

  it("keeps primary browser-only command responses aligned with production DTO schemas", async () => {
    setupDevMocks();

    const accounts = Result.unwrap(await listAccounts());
    expect(AccountDtoListSchema.parse(accounts)).toEqual(accounts);
    expect(AccountDtoSchema.parse(Result.unwrap(await testAccountConnection("acc-freshrss")))).toBeDefined();
    expect(AccountSyncStatusSchema.parse(Result.unwrap(await getAccountSyncStatus("acc-freshrss")))).toBeDefined();

    const folders = Result.unwrap(await listFolders("acc-freshrss"));
    expect(FolderDtoListSchema.parse(folders)).toEqual(folders);
    expect(FolderDtoSchema.parse(Result.unwrap(await createFolder("acc-freshrss", "Schema")))).toMatchObject({
      account_id: "acc-freshrss",
      name: "Schema",
    });

    const feeds = Result.unwrap(await listFeeds("acc-freshrss"));
    expect(FeedDtoListSchema.parse(feeds)).toEqual(feeds);
    const addedFeed = Result.unwrap(await addLocalFeed("acc-local", "https://schema.example.com/feed.xml"));
    expect(FeedDtoSchema.parse(addedFeed)).toEqual(addedFeed);

    expect(ArticleDtoListSchema.parse(Result.unwrap(await listArticles("feed-automaton", 0, 10)))).toBeDefined();
    expect(ArticleDtoListSchema.parse(Result.unwrap(await listAccountArticles("acc-freshrss", 0, 10)))).toBeDefined();
    expect(ArticleDtoListSchema.parse(Result.unwrap(await listStarredArticles("acc-freshrss")))).toBeDefined();
    expect(ArticleDtoListSchema.parse(Result.unwrap(await listRecentArticles("acc-freshrss", 0, 10)))).toBeDefined();
    expect(ArticleDtoListSchema.parse(Result.unwrap(await searchArticles("acc-local", "Sample", 0, 10)))).toBeDefined();
    expect(
      ArticleDtoListSchema.parse(Result.unwrap(await listArticlesByTag("tag-important", 0, 10, "acc-freshrss", "all"))),
    ).toBeDefined();

    const summaries = Result.unwrap(await listFeedArticleSummaries("acc-freshrss"));
    expect(FeedArticleSummaryDtoListSchema.parse(summaries)).toEqual(summaries);

    const tags = Result.unwrap(await listTags());
    expect(TagDtoListSchema.parse(tags)).toEqual(tags);
    expect(TagDtoSchema.parse(Result.unwrap(await createTag("schema")))).toBeDefined();
    expect(TagDtoListSchema.parse(Result.unwrap(await getArticleTags("art-1")))).toBeDefined();
    const tagCounts = Result.unwrap(await getTagArticleCounts("acc-freshrss"));
    expect(TagArticleCountsSchema.parse(tagCounts)).toEqual(tagCounts);

    expect(MuteKeywordDtoSchema.parse(Result.unwrap(await createMuteKeyword("schema", "title")))).toBeDefined();
    expect(MuteKeywordDtoListSchema.parse(Result.unwrap(await listMuteKeywords()))).toBeDefined();

    expect(DevRuntimeOptionsSchema.parse(Result.unwrap(await getDevRuntimeOptions()))).toBeDefined();
    expect(PlatformInfoSchema.parse(Result.unwrap(await getPlatformInfo()))).toBeDefined();
    expect(PreferencesDtoSchema.parse(Result.unwrap(await getPreferences()))).toBeDefined();

    const browserState = Result.unwrap(
      await createOrUpdateBrowserWebview("https://example.com/article", browserBounds),
    );
    expect(BrowserWebviewStateSchema.parse(browserState)).toEqual(browserState);
    expect(BrowserWebviewStateSchema.parse(Result.unwrap(await goBackBrowserWebview()))).toBeDefined();
    expect(BrowserWebviewStateSchema.parse(Result.unwrap(await goForwardBrowserWebview()))).toBeDefined();
    expect(BrowserWebviewStateSchema.parse(Result.unwrap(await reloadBrowserWebview()))).toBeDefined();

    expect(
      DiscoveredFeedDtoListSchema.parse(Result.unwrap(await discoverFeeds("https://schema.example.com"))),
    ).toBeDefined();
    expect(SyncResultSchema.parse(Result.unwrap(await triggerSync()))).toBeDefined();
    expect(SyncResultSchema.parse(Result.unwrap(await triggerStartupSync("acc-freshrss")))).toBeDefined();
    expect(SyncResultSchema.parse(Result.unwrap(await syncAccount("acc-freshrss")))).toBeDefined();
    expect(SyncResultSchema.parse(Result.unwrap(await syncFeed("feed-automaton")))).toBeDefined();
    expect(SyncResultSchema.parse(Result.unwrap(await triggerAutomaticSync()))).toBeDefined();
    expect(StringResponseSchema.parse(Result.unwrap(await exportOpml("acc-freshrss")))).toContain("<opml");
    expect(
      CountResponseSchema.parse(Result.unwrap(await clearArticleViewHistory("acc-freshrss"))),
    ).toBeGreaterThanOrEqual(0);
    expect(DatabaseInfoDtoSchema.parse(Result.unwrap(await getDatabaseInfo()))).toBeDefined();
    expect(DatabaseInfoDtoSchema.parse(Result.unwrap(await vacuumDatabase()))).toBeDefined();
  });

  it("keeps browser-only external opener commands observable without calling window.open", async () => {
    setupDevMocks();
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    Result.unwrap(await openInBrowser("https://example.com/article", false));
    Result.unwrap(await openExternalUrl("mailto:?subject=First&body=https%3A%2F%2Fexample.com"));
    Result.unwrap(await addToReadingList("https://example.com/read-later"));

    expect(windowOpenSpy).not.toHaveBeenCalled();
    expect((window as DevMockExternalOpenerTestWindow).__ULTRA_RSS_DEV_MOCK_EXTERNAL_OPENS__).toEqual([
      {
        command: "open_in_browser",
        url: "https://example.com/article",
        target: "_blank",
      },
      {
        command: "plugin:opener|open_url",
        url: "mailto:?subject=First&body=https%3A%2F%2Fexample.com",
        target: "_blank",
      },
      {
        command: "add_to_reading_list",
        url: "https://example.com/read-later",
        target: "reading-list",
      },
    ]);
    windowOpenSpy.mockRestore();
  });

  it("documents browser-only network boundaries for real-domain mock URLs", async () => {
    setupDevMocks();

    expect(
      Result.unwrap(await createOrUpdateBrowserWebview("https://www3.nhk.or.jp/news/html/mock.html", browserBounds)),
    ).toMatchObject({
      url: "https://www3.nhk.or.jp/news/html/mock.html",
      is_loading: false,
    });
    expect(Result.unwrap(await discoverFeeds("https://www3.nhk.or.jp"))).toEqual([
      { url: "https://www3.nhk.or.jp/feed", title: "Main Feed" },
      { url: "https://www3.nhk.or.jp/comments/feed", title: "Comments Feed" },
    ]);
  });

  it("keeps browser-only browser embed URL fallback aligned with command URL policy", async () => {
    setupDevMocks();

    expect(Result.unwrap(await checkBrowserEmbedSupport("https://example.com/article"))).toBe(true);
    expect(Result.unwrap(await checkBrowserEmbedSupport("https://note.com/npaka/n/example"))).toBe(false);

    for (const url of [
      "not-a-url",
      "mailto:hello@example.com",
      "file:///tmp/article.html",
      "reader://article/1",
      "https://example.com/article\nnext",
    ]) {
      expect(Result.isFailure(await checkBrowserEmbedSupport(url))).toBe(true);
      expect(Result.isFailure(await createOrUpdateBrowserWebview(url, browserBounds))).toBe(true);
      expect(Result.isFailure(await openInBrowser(url, false))).toBe(true);
    }
  });

  it("keeps old-unread time filtering aligned with command argument boundaries", async () => {
    setupDevMocks();

    mockArticles.push(
      {
        id: "dev-invalid-date",
        feed_id: "feed-automaton",
        title: "Invalid date",
        content_sanitized: "<p>invalid</p>",
        summary: "invalid",
        url: "https://example.com/invalid-date",
        author: null,
        published_at: "not-a-date",
        thumbnail: null,
        is_read: false,
        is_starred: false,
      },
      {
        id: "dev-future-date",
        feed_id: "feed-automaton",
        title: "Future date",
        content_sanitized: "<p>future</p>",
        summary: "future",
        url: "https://example.com/future-date",
        author: null,
        published_at: "2999-01-01T00:00:00.000Z",
        thumbnail: null,
        is_read: false,
        is_starred: false,
      },
    );

    const before = Result.unwrap(await countOldUnreadArticles("feed", "feed-automaton", 7));
    Result.unwrap(await markOldUnreadRead("feed", "feed-automaton", 7));
    const after = Result.unwrap(await countOldUnreadArticles("feed", "feed-automaton", 7));

    expect(before).toBe(0);
    expect(after).toBe(0);
    expect(mockArticles.find((article) => article.id === "dev-invalid-date")?.is_read).toBe(false);
    expect(mockArticles.find((article) => article.id === "dev-future-date")?.is_read).toBe(false);
    await expect(
      invoke("count_old_unread_articles", {
        scopeKind: "feed",
        targetId: "feed-automaton",
        olderThanDays: 0,
      }),
    ).rejects.toBeDefined();
    await expect(
      invoke("count_old_unread_articles", {
        scopeKind: "feed",
        targetId: "feed-automaton",
        olderThanDays: -1,
      }),
    ).rejects.toBeDefined();
  });

  it("returns the requested account for browser-only connection checks", async () => {
    setupDevMocks();

    const account = Result.unwrap(await testAccountConnection("acc-local"));

    expect(account.id).toBe("acc-local");
  });

  it("updates account credential fields in browser-only mode", async () => {
    setupDevMocks();

    const account = Result.unwrap(
      await updateAccountCredentials("acc-freshrss", "https://reader.example.com", "demo-user", "secret"),
    );

    expect(account.id).toBe("acc-freshrss");
    expect(account.server_url).toBe("https://reader.example.com");
    expect(account.username).toBe("demo-user");
  });

  it("returns starred counts and articles in browser-only mode", async () => {
    setupDevMocks();

    const starredCount = Result.unwrap(await countAccountStarredArticles("acc-freshrss"));
    const starredArticles = Result.unwrap(await listStarredArticles("acc-freshrss"));

    expect(starredCount).toBe(2);
    expect(starredArticles).toHaveLength(2);
    expect(starredArticles[0]?.is_starred).toBe(true);
  });

  it("applies mute filtering before recent article pagination without underfilling the page", async () => {
    setupDevMocks();

    Result.unwrap(await recordArticleView("acc-freshrss", "art-3"));
    Result.unwrap(await createMuteKeyword("Havendock", "title"));

    const firstPage = Result.unwrap(await listRecentArticles("acc-freshrss", 0, 2));
    const secondPage = Result.unwrap(await listRecentArticles("acc-freshrss", 2, 2));

    expect(firstPage.map((article) => article.id)).toEqual(["art-3", "art-1"]);
    expect(secondPage).toEqual([]);
  });

  it("matches browser-only body mute keywords against extracted visible body text", async () => {
    setupDevMocks();

    mockArticles.push(
      {
        id: "dev-body-hidden-attribute",
        feed_id: "feed-automaton",
        title: "Visible link article",
        content_sanitized: '<p><a href="https://example.com/kindle">Visible text</a></p>',
        summary: "Summary without muted keyword",
        url: "https://example.com/visible-link",
        author: null,
        published_at: "2026-04-20T12:00:00.000Z",
        thumbnail: null,
        is_read: false,
        is_starred: false,
      },
      {
        id: "dev-body-inline-visible",
        feed_id: "feed-automaton",
        title: "Inline body article",
        content_sanitized: "<p>Kindle <strong>Unlimited</strong></p>",
        summary: "Summary fallback is ignored",
        url: "https://example.com/inline-body",
        author: null,
        published_at: "2026-04-20T12:01:00.000Z",
        thumbnail: null,
        is_read: false,
        is_starred: false,
      },
      {
        id: "dev-body-block-visible",
        feed_id: "feed-automaton",
        title: "Block body article",
        content_sanitized: "<p>Kindle</p><p>Unlimited</p>",
        summary: "Summary fallback is ignored",
        url: "https://example.com/block-body",
        author: null,
        published_at: "2026-04-20T12:01:30.000Z",
        thumbnail: null,
        is_read: false,
        is_starred: false,
      },
      {
        id: "dev-body-summary-fallback",
        feed_id: "feed-automaton",
        title: "Summary body article",
        content_sanitized: "   ",
        summary: "Kindle Unlimited summary",
        url: "https://example.com/summary-body",
        author: null,
        published_at: "2026-04-20T12:02:00.000Z",
        thumbnail: null,
        is_read: false,
        is_starred: false,
      },
    );
    Result.unwrap(await createMuteKeyword("kindle unlimited", "body"));

    const visibleArticles = Result.unwrap(await listArticles("feed-automaton", 0, 50));

    expect(visibleArticles.map((article) => article.id)).toContain("dev-body-hidden-attribute");
    expect(visibleArticles.map((article) => article.id)).not.toContain("dev-body-inline-visible");
    expect(visibleArticles.map((article) => article.id)).not.toContain("dev-body-block-visible");
    expect(visibleArticles.map((article) => article.id)).not.toContain("dev-body-summary-fallback");
  });

  it("scopes search results to the account before pagination", async () => {
    setupDevMocks();
    Result.unwrap(await addLocalFeed("acc-local", "https://local.example.com/feed.xml"));

    const freshRssFirstPage = Result.unwrap(await searchArticles("acc-freshrss", "Article", 0, 1));
    const localFirstPage = Result.unwrap(await searchArticles("acc-local", "Article", 0, 1));
    const localSecondPage = Result.unwrap(await searchArticles("acc-local", "Article", 1, 1));

    expect(freshRssFirstPage).toHaveLength(0);
    expect(localFirstPage.map((article) => article.id)).toEqual(["dev-feed-100-art-0"]);
    expect(localSecondPage.map((article) => article.id)).toEqual(["dev-feed-100-art-1"]);
  });

  it("keeps browser-only list output ordering stable with lookup indexes", async () => {
    setupDevMocks();

    expect(
      Result.unwrap(await listFeeds("acc-freshrss"))
        .slice(0, 3)
        .map((feed) => feed.id),
    ).toEqual(["feed-automaton", "feed-hatima", "feed-yumenavi"]);
    const accountArticles = Result.unwrap(await listAccountArticles("acc-freshrss", 0, 3));

    expect(accountArticles.map((article) => article.id)).toEqual(["art-1", "art-2", "art-3"]);
    expect(Result.unwrap(await listStarredArticles("acc-freshrss")).map((article) => article.id)).toEqual([
      "art-4",
      "art-8",
    ]);
    expect(Result.unwrap(await listFeedArticleSummaries("acc-freshrss")).slice(0, 3)).toEqual([
      {
        feed_id: "feed-automaton",
        latest_article_at: accountArticles[0]?.published_at,
        starred_count: 0,
      },
      {
        feed_id: "feed-hatima",
        latest_article_at: null,
        starred_count: 0,
      },
      {
        feed_id: "feed-yumenavi",
        latest_article_at: null,
        starred_count: 0,
      },
    ]);
    expect(
      Result.unwrap(await listArticlesByTag("tag-important", 0, 10, "acc-freshrss", "all")).map(
        (article) => article.id,
      ),
    ).toEqual(["art-1"]);
    expect(Result.unwrap(await listRecentArticles("acc-freshrss", 0, 10)).map((article) => article.id)).toEqual([
      "art-2",
      "art-1",
    ]);
  });

  it("resets mutable browser-only mock state on each setup", async () => {
    setupDevMocks();

    const firstFeed = Result.unwrap(await addLocalFeed("acc-local", "https://stateful.example.com/feed.xml"));
    const firstTag = Result.unwrap(await createTag("stateful"));
    Result.unwrap(await setPreference("reader_mode_default", "false"));

    expect(firstFeed.id).toBe("dev-feed-100");
    expect(firstTag.id).toBe("dev-tag-100");
    expect(Result.unwrap(await getPreferences()).reader_mode_default).toBe("false");
    expect(Result.unwrap(await listFeeds("acc-local")).some((feed) => feed.id === firstFeed.id)).toBe(true);

    setupDevMocks();

    expect(Result.unwrap(await listFeeds("acc-local")).some((feed) => feed.id === firstFeed.id)).toBe(false);

    const secondFeed = Result.unwrap(await addLocalFeed("acc-local", "https://stateful.example.com/feed.xml"));
    const secondTag = Result.unwrap(await createTag("stateful"));

    expect(secondFeed.id).toBe("dev-feed-100");
    expect(secondTag.id).toBe("dev-tag-100");
    expect(Result.unwrap(await getPreferences())).toEqual({});
    expect(Result.unwrap(await listFeeds("acc-local")).filter((feed) => feed.id === firstFeed.id)).toHaveLength(1);
  });

  it("cascades account deletion across browser-only feeds, folders, articles, and recent history", async () => {
    setupDevMocks();

    expect(Result.unwrap(await listFeeds("acc-freshrss")).length).toBeGreaterThan(0);
    expect(Result.unwrap(await listFolders("acc-freshrss")).length).toBeGreaterThan(0);
    expect(Result.unwrap(await listRecentArticles("acc-freshrss", 0, 10)).length).toBeGreaterThan(0);
    expect(Result.unwrap(await countAccountUnreadArticles("acc-freshrss"))).toBeGreaterThan(0);
    expect(Result.unwrap(await getArticleTags("art-1")).map((tag) => tag.id)).toEqual(["tag-important", "tag-work"]);

    Result.unwrap(await deleteAccount("acc-freshrss"));

    expect(Result.unwrap(await listFeeds("acc-freshrss"))).toEqual([]);
    expect(Result.unwrap(await listFolders("acc-freshrss"))).toEqual([]);
    expect(Result.unwrap(await listRecentArticles("acc-freshrss", 0, 10))).toEqual([]);
    expect(Result.unwrap(await countAccountUnreadArticles("acc-freshrss"))).toBe(0);
    expect(Result.unwrap(await countAccountStarredArticles("acc-freshrss"))).toBe(0);
    expect(Result.unwrap(await getArticleTags("art-1"))).toEqual([]);
    expect(Result.unwrap(await getTagArticleCounts("acc-freshrss"))).toEqual({});
  });

  it("cascades feed deletion across browser-only article tags and recent history", async () => {
    setupDevMocks();

    const deletedArticleId = "art-1";
    Result.unwrap(await recordArticleView("acc-freshrss", deletedArticleId));

    expect(Result.unwrap(await getArticleTags(deletedArticleId)).map((tag) => tag.id)).toEqual([
      "tag-important",
      "tag-work",
    ]);
    expect(Result.unwrap(await listRecentArticles("acc-freshrss", 0, 10)).map((article) => article.id)).toContain(
      deletedArticleId,
    );

    Result.unwrap(await deleteFeed("feed-automaton"));

    expect(Result.unwrap(await getArticleTags(deletedArticleId))).toEqual([]);
    expect(Result.unwrap(await listRecentArticles("acc-freshrss", 0, 10)).map((article) => article.id)).not.toContain(
      deletedArticleId,
    );
    expect(Result.unwrap(await clearArticleViewHistory("acc-freshrss"))).toBe(0);
  });

  it("cascades tag deletion across browser-only article tag joins", async () => {
    setupDevMocks();

    expect(Result.unwrap(await getArticleTags("art-1")).map((tag) => tag.id)).toEqual(["tag-important", "tag-work"]);

    Result.unwrap(await deleteTag("tag-important"));

    expect(Result.unwrap(await listTags()).map((tag) => tag.id)).not.toContain("tag-important");
    expect(Result.unwrap(await getArticleTags("art-1")).map((tag) => tag.id)).toEqual(["tag-work"]);
    expect(Result.unwrap(await listArticlesByTag("tag-important", 0, 10, "acc-freshrss", "all"))).toEqual([]);
    expect(Result.unwrap(await getTagArticleCounts("acc-freshrss"))).not.toHaveProperty("tag-important");
  });

  it("rejects browser-only folder moves that production would reject", async () => {
    setupDevMocks();

    const beforeFeeds = Result.unwrap(await listFeeds("acc-freshrss"));
    const targetFeed = beforeFeeds.find((feed) => feed.id === "feed-automaton");
    const originalFolderId = targetFeed?.folder_id;
    const otherAccountFolder = Result.unwrap(await createFolder("acc-local", "Other account"));

    expect(originalFolderId).toBeTruthy();

    expect(Result.unwrapError(await updateFeedFolder("missing-feed", "folder-tech"))).toMatchObject({
      message: "Feed not found",
    });
    expect(Result.unwrapError(await updateFeedFolder("feed-automaton", "missing-folder"))).toMatchObject({
      message: "Folder not found",
    });
    expect(Result.unwrapError(await updateFeedFolder("feed-automaton", otherAccountFolder.id))).toMatchObject({
      message: "Folder belongs to another account",
    });

    expect(Result.unwrap(await listFeeds("acc-freshrss")).find((feed) => feed.id === "feed-automaton")?.folder_id).toBe(
      originalFolderId,
    );
  });

  it("rejects unknown browser-only commands instead of returning a null success", async () => {
    setupDevMocks();
    const diagnosticEvents: unknown[] = [];
    window.addEventListener("ultra-rss-dev-mock-diagnostics", (event) => {
      diagnosticEvents.push((event as CustomEvent).detail);
    });

    await expect(invoke("unknown_dev_command")).rejects.toThrow("[dev-mocks] Unknown command: unknown_dev_command");
    expect((window as DevMockDiagnosticsTestWindow).__ULTRA_RSS_DEV_MOCK_DIAGNOSTICS__).toEqual([
      {
        kind: "unknown-command",
        command: "unknown_dev_command",
        message: "[dev-mocks] Unknown command: unknown_dev_command",
      },
    ]);
    expect(diagnosticEvents).toEqual([
      {
        kind: "unknown-command",
        command: "unknown_dev_command",
        message: "[dev-mocks] Unknown command: unknown_dev_command",
      },
    ]);
    expect(document.querySelector('[data-testid="dev-mock-diagnostics-canvas"]')?.textContent).toBe(
      "[dev-mocks] Unknown command: unknown_dev_command",
    );
  });

  it("supports Tauri event subscriptions in browser-only mock mode", async () => {
    setupDevMocks();

    const unlisten = await listen("sync-completed", () => undefined);

    expect(unlisten).toEqual(expect.any(Function));
    expect(document.querySelector('[data-testid="dev-mock-diagnostics-canvas"]')).toBeNull();

    await expect(unlisten()).resolves.toBeUndefined();
  });

  it("resets browser-only external side effect records and diagnostics between mock runtime installs", async () => {
    setupDevMocks();

    Result.unwrap(await openInBrowser("https://example.com/first", false));
    await expect(invoke("unknown_dev_command")).rejects.toThrow("[dev-mocks] Unknown command: unknown_dev_command");

    expect((window as DevMockExternalOpenerTestWindow).__ULTRA_RSS_DEV_MOCK_EXTERNAL_OPENS__).toHaveLength(1);
    expect((window as DevMockDiagnosticsTestWindow).__ULTRA_RSS_DEV_MOCK_DIAGNOSTICS__).toHaveLength(1);
    expect(document.querySelector('[data-testid="dev-mock-diagnostics-canvas"]')).not.toBeNull();

    setupDevMocks();

    expect((window as DevMockExternalOpenerTestWindow).__ULTRA_RSS_DEV_MOCK_EXTERNAL_OPENS__).toEqual([]);
    expect((window as DevMockDiagnosticsTestWindow).__ULTRA_RSS_DEV_MOCK_DIAGNOSTICS__).toEqual([]);
    expect(document.querySelector('[data-testid="dev-mock-diagnostics-canvas"]')).toBeNull();
  });

  it("validates raw browser-only IPC payloads at the mock command boundary", async () => {
    setupDevMocks();

    await expect(invoke("list_feeds", { accountId: 123 })).rejects.toThrow();
  });

  it("returns an empty integrity report in browser-only mode", async () => {
    setupDevMocks();

    const result = await getFeedIntegrityReport();
    const report = Result.unwrap(result);

    expect(FeedIntegrityReportDtoSchema.parse(report)).toEqual(report);
    expect(report).toEqual({
      orphaned_article_count: 0,
      orphaned_feeds: [],
    });
  });

  it("keeps feed integrity cleanup mock responses aligned with the production DTO schema", async () => {
    setupDevMocks();

    const feedsBeforeCleanup = Result.unwrap(await listFeeds("acc-freshrss"));
    const dryRun = Result.unwrap(await cleanupFeedIntegrityOrphans(true));
    const cleanup = Result.unwrap(await cleanupFeedIntegrityOrphans(false));

    expect(FeedIntegrityCleanupDtoSchema.parse(dryRun)).toEqual(dryRun);
    expect(FeedIntegrityCleanupDtoSchema.parse(cleanup)).toEqual(cleanup);
    expect(dryRun).toEqual({
      dry_run: true,
      orphaned_article_count: 0,
      deleted_article_count: 0,
      orphaned_article_ids: [],
    });
    expect(cleanup).toEqual({
      dry_run: false,
      orphaned_article_count: 0,
      deleted_article_count: 0,
    });
    expect(Result.unwrap(await listFeeds("acc-freshrss"))).toEqual(feedsBeforeCleanup);
  });

  it("keeps browser-only OPML import explicitly unsupported without mutating feeds", async () => {
    setupDevMocks();

    const feedsBeforeImport = Result.unwrap(await listFeeds("acc-freshrss"));
    const result = await importOpml("acc-freshrss", "<opml><body /></opml>");

    expect(Result.unwrapError(result)).toMatchObject({
      type: "UserVisible",
      message: "Browser-only dev mocks do not import OPML because it would create feeds.",
    });
    expect(Result.unwrap(await listFeeds("acc-freshrss"))).toEqual(feedsBeforeImport);
  });
});
