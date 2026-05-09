import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Result } from "@praha/byethrow";
import { invoke } from "@tauri-apps/api/core";
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commandArgsSchemas } from "@/api/schemas";
import { FeedIntegrityCleanupDtoSchema, FeedIntegrityReportDtoSchema } from "@/api/schemas/feed-integrity";
import { PlatformInfoSchema } from "@/api/schemas/platform-info";
import {
  addLocalFeed,
  cleanupFeedIntegrityOrphans,
  clearArticleViewHistory,
  countAccountStarredArticles,
  countAccountUnreadArticles,
  createMuteKeyword,
  createOrUpdateBrowserWebview,
  createTag,
  deleteAccount,
  deleteFeed,
  getAccountSyncStatus,
  getArticleTags,
  getDevRuntimeOptions,
  getFeedIntegrityReport,
  getPlatformInfo,
  getPreferences,
  getTagArticleCounts,
  listAccountArticles,
  listArticlesByTag,
  listFeeds,
  listFolders,
  listRecentArticles,
  listStarredArticles,
  recordArticleView,
  searchArticles,
  setPreference,
  testAccountConnection,
  updateAccountCredentials,
} from "@/api/tauri-commands";
import { DEFAULT_PLATFORM_INFO } from "@/constants/platform";
import { DEV_MOCK_PLATFORM_INFO, setupDevMocks } from "@/dev/mocks";
import type { BrowserWebviewBounds } from "@/lib/browser/browser-webview";

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
  });

  afterEach(() => {
    clearMocks();
    vi.unstubAllEnvs();
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

  it("keeps browser-only mock platform capabilities aligned with production defaults", () => {
    expect(PlatformInfoSchema.parse(DEV_MOCK_PLATFORM_INFO)).toEqual(DEV_MOCK_PLATFORM_INFO);
    expect(DEV_MOCK_PLATFORM_INFO).toEqual(DEFAULT_PLATFORM_INFO);
  });

  it("returns account sync status for browser-only account settings checks", async () => {
    setupDevMocks();

    const result = await getAccountSyncStatus("acc-1");
    const status = Result.unwrap(result);

    expect(status).toEqual({
      last_success_at: null,
      last_error: null,
      error_count: 0,
      next_retry_at: null,
    });
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

  it("applies mute filtering before recent article pagination", async () => {
    setupDevMocks();

    Result.unwrap(await createMuteKeyword("Havendock", "title"));

    const firstPage = Result.unwrap(await listRecentArticles("acc-freshrss", 0, 1));
    const secondPage = Result.unwrap(await listRecentArticles("acc-freshrss", 1, 1));

    expect(firstPage.map((article) => article.id)).toEqual(["art-1"]);
    expect(secondPage).toEqual([]);
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
    expect(Result.unwrap(await listAccountArticles("acc-freshrss", 0, 3)).map((article) => article.id)).toEqual([
      "art-1",
      "art-2",
      "art-3",
    ]);
    expect(Result.unwrap(await listStarredArticles("acc-freshrss")).map((article) => article.id)).toEqual([
      "art-4",
      "art-8",
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

  it("keeps every schema-validated command covered by the browser-only mock switch", () => {
    const source = readFileSync(resolve(process.cwd(), "src/dev/mocks.ts"), "utf8");
    const mockedCommands = new Set([...source.matchAll(/case "([^"]+)"/g)].map((match) => match[1]));

    expect(Object.keys(commandArgsSchemas).filter((command) => !mockedCommands.has(command))).toEqual([]);
  });

  it("parses every schema-validated browser-only command at the mock IPC boundary", () => {
    const source = readFileSync(resolve(process.cwd(), "src/dev/mocks.ts"), "utf8");
    const parsedCommands = new Set(
      [...source.matchAll(/parseBrowserMockArgs\(\s*"([^"]+)"/g)].map((match) => match[1]),
    );

    expect(Object.keys(commandArgsSchemas).filter((command) => !parsedCommands.has(command))).toEqual([]);
  });

  it("rejects unknown browser-only commands instead of returning a null success", async () => {
    setupDevMocks();

    await expect(invoke("unknown_dev_command")).rejects.toThrow("[dev-mocks] Unknown command: unknown_dev_command");
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

    const dryRun = Result.unwrap(await cleanupFeedIntegrityOrphans(true));
    const cleanup = Result.unwrap(await cleanupFeedIntegrityOrphans(false));

    expect(FeedIntegrityCleanupDtoSchema.parse(dryRun)).toEqual(dryRun);
    expect(FeedIntegrityCleanupDtoSchema.parse(cleanup)).toEqual(cleanup);
    expect(dryRun).toEqual({
      dry_run: true,
      orphaned_article_count: 0,
      deleted_article_count: 0,
    });
    expect(cleanup).toEqual({
      dry_run: false,
      orphaned_article_count: 0,
      deleted_article_count: 0,
    });
  });
});
