import { Result } from "@praha/byethrow";
import { invoke } from "@tauri-apps/api/core";
import { sampleAccounts, sampleArticles, sampleFeeds } from "@tests/helpers/fixtures";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import {
  type AccountDto,
  addAccount,
  addLocalFeed,
  addToReadingList,
  checkBrowserEmbedSupport,
  type checkForUpdate,
  clearArticleViewHistory,
  closeBrowserWebview,
  copyToClipboard,
  countAccountStarredArticles,
  countAccountUnreadArticles,
  countOldUnreadArticles,
  createFolder,
  createMuteKeyword,
  createOrUpdateBrowserWebview,
  createTag,
  deleteAccount,
  deleteFeed,
  deleteMuteKeyword,
  deleteTag,
  discoverFeeds,
  exportOpml,
  focusBrowserWebview,
  getAccountSyncStatus,
  getArticleTags,
  getDatabaseInfo,
  getPlatformInfo,
  getPreferences,
  goBackBrowserWebview,
  goForwardBrowserWebview,
  listAccountArticles,
  listAccounts,
  listArticles,
  listArticlesByTag,
  listFeeds,
  listFolderArticles,
  listFolders,
  listMuteKeywords,
  listRecentArticles,
  listStarredArticles,
  listTags,
  markAccountRead,
  markAccountStarredRead,
  markArticleRead,
  markArticlesRead,
  markFeedRead,
  markFolderRead,
  markOldUnreadRead,
  openExternalUrl,
  openInBrowser,
  openLogDir,
  type PreferencesDto,
  recordArticleView,
  reloadBrowserWebview,
  renameAccount,
  renameFeed,
  renameTag,
  type restartApp,
  searchArticles,
  setBrowserWebviewBounds,
  setMuteAutoMarkRead,
  setPreference,
  tagArticle,
  testAccountConnection,
  toggleArticleStar,
  triggerAutomaticSync,
  triggerStartupSync,
  triggerSync,
  type UpdateInfoDto,
  unstarAccountArticles,
  untagArticle,
  updateAccountCredentials,
  updateAccountSync,
  updateFeedDisplaySettings,
  updateFeedFolder,
  updateMuteKeyword,
  vacuumDatabase,
} from "@/api/tauri-commands";
import type { BrowserWebviewBounds } from "@/lib/browser/browser-webview";

type CommandSuccess<TCommand> = TCommand extends (...args: infer _Args) => Result.ResultAsync<infer Output, unknown>
  ? Output
  : never;

const responseValidationBrowserBounds: BrowserWebviewBounds = {
  x: 380,
  y: 48,
  width: 900,
  height: 720,
};

const sampleAcc1Feeds = sampleFeeds.filter((feed) => feed.account_id === "acc-1");
const sampleAcc1Articles = sampleArticles.filter((article) =>
  sampleAcc1Feeds.some((feed) => feed.id === article.feed_id),
);

describe("tauri-commands with mockIPC", () => {
  const browserBounds: BrowserWebviewBounds = {
    x: 380,
    y: 48,
    width: 900,
    height: 720,
  };

  beforeEach(() => {
    setupTauriMocks();
  });

  it("keeps high-traffic default mock responses schema-valid", async () => {
    const [
      accountsResult,
      feedsResult,
      articlesResult,
      recentArticlesResult,
      platformInfoResult,
      syncResult,
      automaticSyncResult,
      browserWebviewResult,
      localFeedResult,
      tagsResult,
      tagResult,
      browserEmbedSupportResult,
    ] = await Promise.all([
      listAccounts(),
      listFeeds("acc-1"),
      listArticles("feed-1"),
      listRecentArticles("acc-1"),
      getPlatformInfo(),
      triggerSync(),
      triggerAutomaticSync(),
      createOrUpdateBrowserWebview("https://example.com/article", browserBounds),
      addLocalFeed("acc-1", "https://example.com/feed.xml"),
      listTags(),
      createTag("Later", "#6f8eb8"),
      checkBrowserEmbedSupport("https://example.com/article"),
    ]);

    expect(Result.unwrap(accountsResult)).toEqual(sampleAccounts);
    expect(Result.unwrap(feedsResult)).toEqual(sampleAcc1Feeds);
    expect(Result.unwrap(articlesResult)).toEqual(sampleArticles);
    expect(Result.unwrap(recentArticlesResult).map((article) => article.id)).toEqual(["art-2", "art-1"]);
    expect(Result.unwrap(platformInfoResult).kind).toBe("windows");
    expect(Result.unwrap(syncResult)).toMatchObject({
      synced: true,
      total: 1,
      succeeded: 1,
    });
    expect(Result.unwrap(automaticSyncResult)).toMatchObject({
      synced: false,
      total: 0,
      succeeded: 0,
    });
    expect(Result.unwrap(browserWebviewResult)).toMatchObject({
      url: "https://example.com/article",
      is_loading: true,
    });
    expect(Result.unwrap(localFeedResult)).toMatchObject({
      id: "feed-new",
      account_id: "acc-1",
    });
    expect(Result.unwrap(tagsResult).map((tag) => tag.id)).toContain("tag-1");
    expect(Result.unwrap(tagResult)).toMatchObject({
      name: "Later",
      color: "#6f8eb8",
    });
    expect(Result.unwrap(browserEmbedSupportResult)).toBe(true);
  });

  it("returns fresh default fixture clones from list commands", async () => {
    const [accounts, feeds, articles] = await Promise.all([
      invoke<typeof sampleAccounts>("list_accounts"),
      invoke<typeof sampleFeeds>("list_feeds", {
        accountId: "acc-1",
      }),
      invoke<typeof sampleArticles>("list_articles", {
        feedId: "feed-1",
      }),
    ]);
    const account = accounts[0];
    const feed = feeds[0];
    const article = articles[0];

    expect(account).toBeDefined();
    expect(account?.capabilities).toBeDefined();
    expect(feed).toBeDefined();
    expect(article).toBeDefined();
    if (!account?.capabilities || !feed || !article) {
      throw new Error("Expected default Tauri mock fixtures");
    }

    account.name = "Mutated Account";
    account.capabilities.supports_search = true;
    feed.title = "Mutated Feed";
    article.title = "Mutated Article";

    const [freshAccounts, freshFeeds, freshArticles] = await Promise.all([
      invoke("list_accounts"),
      invoke("list_feeds", { accountId: "acc-1" }),
      invoke("list_articles", { feedId: "feed-1" }),
    ]);

    expect(freshAccounts).toEqual(sampleAccounts);
    expect(freshFeeds).toEqual(sampleAcc1Feeds);
    expect(freshArticles).toEqual(sampleArticles);
  });

  describe("listAccounts", () => {
    it("returns all accounts", async () => {
      const value = Result.unwrap(await listAccounts());
      expect(value).toEqual(sampleAccounts);
      expect(value).toHaveLength(2);
    });
  });

  describe("listFeeds", () => {
    it("returns feeds for a given account", async () => {
      const value = Result.unwrap(await listFeeds("acc-1"));
      expect(value).toEqual(sampleAcc1Feeds);
      expect(value).toHaveLength(1);
    });

    it("returns empty array for unknown account", async () => {
      const value = Result.unwrap(await listFeeds("nonexistent"));
      expect(value).toEqual([]);
    });
  });

  describe("discoverFeeds", () => {
    it("parses discovered feed command responses", async () => {
      setupTauriMocks((cmd, args) => {
        if (cmd === "discover_feeds" && args.url === "https://example.com") {
          return [
            { url: "https://example.com/feed.xml", title: "Main Feed" },
            { url: "https://example.com/atom.xml", title: "" },
          ];
        }
        return undefined;
      });

      expect(Result.unwrap(await discoverFeeds("https://example.com"))).toEqual([
        { url: "https://example.com/feed.xml", title: "Main Feed" },
        { url: "https://example.com/atom.xml", title: "" },
      ]);
    });

    it("rejects invalid discovered feed command response URLs", async () => {
      setupTauriMocks((cmd, args) => {
        if (cmd === "discover_feeds" && args.url === "https://example.com") {
          return [
            { url: "https://example.com/feed.xml", title: "Main Feed" },
            { url: "mailto:hello@example.com", title: "Mail Feed" },
          ];
        }
        return undefined;
      });

      const result = await discoverFeeds("https://example.com");

      expect(Result.isFailure(result)).toBe(true);
      expect(Result.unwrapError(result).message).toContain("validation failed");
    });
  });

  describe("listArticles", () => {
    it("returns articles for a given feed", async () => {
      const value = Result.unwrap(await listArticles("feed-1"));
      expect(value).toEqual(sampleArticles);
      expect(value).toHaveLength(2);
    });

    it("returns empty array for unknown feed", async () => {
      const value = Result.unwrap(await listArticles("nonexistent"));
      expect(value).toEqual([]);
    });
  });

  describe("listAccountArticles", () => {
    it("returns articles for a given account", async () => {
      const value = Result.unwrap(await listAccountArticles("acc-1"));
      expect(value).toEqual(sampleAcc1Articles);
      expect(value).toHaveLength(2);
    });
  });

  describe("listFolderArticles", () => {
    it("returns unread articles for a given folder", async () => {
      setupTauriMocks((cmd, args) => {
        if (cmd === "list_folder_articles" && args.folderId === "folder-1" && args.mode === "unread") {
          return [sampleArticles[0]];
        }
        return undefined;
      });

      const value = Result.unwrap(await listFolderArticles("folder-1", "unread"));
      expect(value.map((article) => article.id)).toEqual(["art-1"]);
    });
  });

  describe("recent article commands", () => {
    it("returns recently viewed articles for a given account", async () => {
      const value = Result.unwrap(await listRecentArticles("acc-1"));
      expect(value.map((article) => article.id)).toEqual(["art-2", "art-1"]);
      expect(value[0]?.viewed_at).toBe("2026-04-20T10:00:00Z");
    });

    it("returns recently viewed articles filtered by mode", async () => {
      const value = Result.unwrap(await listRecentArticles("acc-1", undefined, undefined, "unread"));
      expect(value.map((article) => article.id)).toEqual(["art-1"]);
    });

    it("records and clears recently viewed articles", async () => {
      Result.unwrap(await recordArticleView("acc-1", "art-1"));
      Result.unwrap(await clearArticleViewHistory("acc-1"));
    });

    it("rejects negative clear history counts", async () => {
      setupTauriMocks((cmd) => {
        if (cmd === "clear_article_view_history") {
          return -1;
        }
        return undefined;
      });

      const result = await clearArticleViewHistory("acc-1");

      expect(Result.isFailure(result)).toBe(true);
      expect(Result.unwrapError(result).message).toContain("validation failed");
    });
  });

  describe("tag article commands", () => {
    it("passes mode when listing articles by tag", async () => {
      setupTauriMocks((cmd, args) => {
        if (cmd === "list_articles_by_tag" && args.tagId === "tag-1" && args.mode === "starred") {
          return [sampleArticles[1]];
        }
        return undefined;
      });

      const value = Result.unwrap(await listArticlesByTag("tag-1", undefined, undefined, "acc-1", "starred"));
      expect(value.map((article) => article.id)).toEqual(["art-2"]);
    });
  });

  describe("log commands", () => {
    it("opens the native log directory without exposing a path to the webview", async () => {
      let invoked = false;
      setupTauriMocks((cmd, args) => {
        if (cmd === "open_log_dir") {
          invoked = true;
          expect(args).toEqual({});
          return null;
        }
        return undefined;
      });

      Result.unwrap(await openLogDir());

      expect(invoked).toBe(true);
    });
  });

  describe("countAccountUnreadArticles", () => {
    it("returns unread count for a given account", async () => {
      const value = Result.unwrap(await countAccountUnreadArticles("acc-1"));
      expect(value).toBe(1);
    });

    it("rejects negative count-style responses", async () => {
      const countCommandCases = [
        ["count_account_unread_articles", () => countAccountUnreadArticles("acc-1")],
        ["count_account_starred_articles", () => countAccountStarredArticles("acc-1")],
        ["count_old_unread_articles", () => countOldUnreadArticles("feed", "feed-1", 30)],
      ] as const;

      setupTauriMocks((cmd) => {
        if (countCommandCases.some(([command]) => command === cmd)) {
          return -1;
        }
        return undefined;
      });

      for (const [command, runCommand] of countCommandCases) {
        const result = await runCommand();
        expect(Result.isFailure(result), command).toBe(true);
        expect(Result.unwrapError(result).message).toContain("validation failed");
      }
    });
  });

  describe("starred fallbacks", () => {
    it("treats transient null starred count responses as zero", async () => {
      setupTauriMocks((cmd) => {
        if (cmd === "count_account_starred_articles") {
          return null;
        }
        return undefined;
      });

      const value = Result.unwrap(await countAccountStarredArticles("acc-1"));
      expect(value).toBe(0);
    });

    it("treats transient null starred article responses as an empty list", async () => {
      setupTauriMocks((cmd) => {
        if (cmd === "list_starred_articles") {
          return null;
        }
        return undefined;
      });

      const value = Result.unwrap(await listStarredArticles("acc-1"));
      expect(value).toEqual([]);
    });
  });

  describe("mute keyword commands", () => {
    it("returns saved mute keywords", async () => {
      setupTauriMocks((cmd) => {
        if (cmd === "list_mute_keywords") {
          return [
            {
              id: "mute-1",
              keyword: "Kindle Unlimited",
              scope: "title_and_body",
              created_at: "2026-04-15T01:00:00Z",
              updated_at: "2026-04-15T01:00:00Z",
            },
          ];
        }
        return undefined;
      });

      const value = Result.unwrap(await listMuteKeywords());
      expect(value).toHaveLength(1);
      expect(value[0].keyword).toBe("Kindle Unlimited");
    });

    it("creates a mute keyword", async () => {
      setupTauriMocks((cmd, args) => {
        if (cmd === "create_mute_keyword") {
          return {
            id: "mute-1",
            keyword: String(args.keyword),
            scope: String(args.scope),
            created_at: "2026-04-15T01:00:00Z",
            updated_at: "2026-04-15T01:00:00Z",
          };
        }
        return undefined;
      });

      const value = Result.unwrap(await createMuteKeyword("Kindle Unlimited", "title"));
      expect(value.scope).toBe("title");
    });

    it("updates a mute keyword scope", async () => {
      setupTauriMocks((cmd, args) => {
        if (cmd === "update_mute_keyword") {
          return {
            id: String(args.muteKeywordId),
            keyword: "Kindle Unlimited",
            scope: String(args.scope),
            created_at: "2026-04-15T01:00:00Z",
            updated_at: "2026-04-15T01:10:00Z",
          };
        }
        return undefined;
      });

      const value = Result.unwrap(await updateMuteKeyword("mute-1", "body"));
      expect(value.scope).toBe("body");
    });

    it("toggles mute auto mark as read", async () => {
      setupTauriMocks((cmd) => {
        if (cmd === "set_mute_auto_mark_read") {
          return null;
        }
        return undefined;
      });

      Result.unwrap(await setMuteAutoMarkRead(true));
    });
  });

  describe("addAccount", () => {
    it("returns a new account DTO", async () => {
      const value = Result.unwrap(await addAccount("Local", "My Feed"));
      expect(value).toEqual({
        id: "acc-new",
        kind: "Local",
        name: "My Feed",
        display_name: "My Feed",
        icon_url: null,
        capabilities: {
          supports_folders: false,
          supports_starring: false,
          supports_search: false,
          supports_delta_sync: false,
          supports_remote_state: false,
        },
        server_url: null,
        username: null,
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
      });
    });
  });

  describe("markArticleRead", () => {
    it("succeeds without error", async () => {
      Result.unwrap(await markArticleRead("art-1"));
    });
  });

  describe("bulk article commands", () => {
    it("marks account articles as read", async () => {
      Result.unwrap(await markAccountRead("acc-1"));
    });

    it("marks account starred articles as read", async () => {
      Result.unwrap(await markAccountStarredRead("acc-1"));
    });

    it("counts and marks old unread articles", async () => {
      const count = Result.unwrap(await countOldUnreadArticles("feed", "feed-1", 30));

      expect(count).toBe(1);
      Result.unwrap(await markOldUnreadRead("feed", "feed-1", 30));
    });

    it("unstars account articles", async () => {
      Result.unwrap(await unstarAccountArticles("acc-1"));
    });
  });

  describe("browser webview commands", () => {
    it("creates or updates the dedicated browser webview window", async () => {
      const value = Result.unwrap(await createOrUpdateBrowserWebview("https://example.com/article", browserBounds));

      expect(value).toEqual({
        url: "https://example.com/article",
        can_go_back: false,
        can_go_forward: false,
        is_loading: true,
        load_generation: 1,
      });
    });

    it("trims browser command URLs before invoking Tauri", async () => {
      setupTauriMocks((cmd, args) => {
        if (cmd === "check_browser_embed_support") {
          expect(args).toEqual({
            url: "https://example.com/article",
          });
          return true;
        }
        if (cmd === "create_or_update_browser_webview") {
          expect(args).toEqual({
            url: "https://example.com/article",
            bounds: browserBounds,
          });
          return {
            url: "https://example.com/article",
            can_go_back: false,
            can_go_forward: false,
            is_loading: true,
            load_generation: 1,
          };
        }
        return undefined;
      });

      Result.unwrap(await checkBrowserEmbedSupport(" https://example.com/article "));
      Result.unwrap(await createOrUpdateBrowserWebview(" https://example.com/article ", browserBounds));
    });

    it.each([
      "",
      "   ",
      "mailto:hello@example.com",
      "file:///tmp/article.html",
      "https://example.com/article\nnext",
      "https://example.com/article\rnext",
    ])("rejects invalid browser command URL %j before invoking Tauri", async (url) => {
      const invokedCommands: string[] = [];
      setupTauriMocks((cmd) => {
        if (cmd === "check_browser_embed_support" || cmd === "create_or_update_browser_webview") {
          invokedCommands.push(cmd);
        }
        return undefined;
      });

      const [supportResult, webviewResult] = await Promise.all([
        checkBrowserEmbedSupport(url),
        createOrUpdateBrowserWebview(url, browserBounds),
      ]);

      expect(Result.isFailure(supportResult)).toBe(true);
      expect(Result.unwrapError(supportResult).message).toContain("validation failed");
      expect(Result.isFailure(webviewResult)).toBe(true);
      expect(Result.unwrapError(webviewResult).message).toContain("validation failed");
      expect(invokedCommands).toEqual([]);
    });

    it("rejects invalid browser webview bounds before invoking Tauri", async () => {
      let invoked = false;
      setupTauriMocks((cmd) => {
        if (cmd === "create_or_update_browser_webview") {
          invoked = true;
        }
        return undefined;
      });

      const result = await createOrUpdateBrowserWebview("https://example.com/article", {
        ...browserBounds,
        width: 0,
      });

      expect(Result.isFailure(result)).toBe(true);
      expect(Result.unwrapError(result).message).toContain("validation failed");
      expect(invoked).toBe(false);
    });

    it("returns the updated navigation state after go back", async () => {
      const value = Result.unwrap(await goBackBrowserWebview());

      expect(value).toEqual({
        url: "https://example.com/article",
        can_go_back: false,
        can_go_forward: false,
        is_loading: false,
        load_generation: 1,
      });
    });

    it("focuses the dedicated browser webview", async () => {
      Result.unwrap(await focusBrowserWebview());
    });
  });

  describe("getPlatformInfo", () => {
    it("returns platform info from getPlatformInfo", async () => {
      const value = Result.unwrap(await getPlatformInfo());
      expect(value).toEqual({
        kind: "windows",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      });
    });
  });

  describe("getAccountSyncStatus", () => {
    it("returns account sync status from getAccountSyncStatus", async () => {
      const value = Result.unwrap(await getAccountSyncStatus("acc-1"));
      expect(value).toEqual({
        last_success_at: null,
        last_error: null,
        error_count: 0,
        next_retry_at: null,
      });
    });
  });
});

describe("tauri-commands with custom handler", () => {
  it("returns error for failing command", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        throw { type: "UserVisible", message: "Connection failed" };
      }
      return null;
    });

    const error = Result.unwrapError(await listAccounts());
    expect(error.message).toBe("Connection failed");
  });

  it("redacts URL credentials, query, and hash from structured command errors before logging or returning them", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        throw {
          type: "UserVisible",
          message: "Fetch failed for https://user:secret@example.com/feed.xml?token=raw-token#auth-fragment",
        };
      }
      return null;
    });

    const error = Result.unwrapError(await listAccounts());

    expect(error.message).toBe("Fetch failed for https://example.com/feed.xml?redacted#redacted");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("raw-token");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("auth-fragment");
  });

  it("redacts URL tokens from unknown rejected values before logging or returning fallback messages", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") {
        throw new Error("Fetch failed for https://user:secret@example.com/feed.xml?token=raw-token#auth-fragment.");
      }
      return null;
    });

    const error = Result.unwrapError(await listAccounts());

    expect(error.message).toBe("Fetch failed for https://example.com/feed.xml?redacted#redacted.");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("secret");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("raw-token");
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("auth-fragment");
  });
});

describe("safeInvoke response validation", () => {
  it("keeps schema-backed command return types derived from response schemas", () => {
    expectTypeOf<CommandSuccess<typeof listAccounts>>().toEqualTypeOf<AccountDto[]>();
    expectTypeOf<CommandSuccess<typeof getPreferences>>().toEqualTypeOf<PreferencesDto>();
    expectTypeOf<CommandSuccess<typeof checkForUpdate>>().toEqualTypeOf<UpdateInfoDto | null>();
    expectTypeOf<CommandSuccess<typeof restartApp>>().toEqualTypeOf<null>();
    expectTypeOf<CommandSuccess<typeof openLogDir>>().toEqualTypeOf<null>();
  });

  it("returns error when response shape is invalid", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") return [{ id: "acc-1" }]; // missing fields
      return null;
    });
    const result = await listAccounts();
    expect(Result.isFailure(result)).toBe(true);
    const error = Result.unwrapError(result);
    expect(error.type).toBe("Diagnostics");
    expect(error.message).toBe("Response validation failed. See diagnostics for details.");
    expect(error.message).not.toContain("acc-1");
    expect(errorSpy).toHaveBeenCalledWith(
      "[tauri-commands] list_accounts response validation failed:",
      expect.stringContaining("name"),
    );
    errorSpy.mockRestore();
  });

  it("caps response validation diagnostics detail", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") return [{ id: 1, kind: 2, name: 3, server_url: 4, username: 5 }];
      return null;
    });

    const result = await listAccounts();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toEqual({
      type: "Diagnostics",
      message: "Response validation failed. See diagnostics for details.",
    });
    const diagnosticDetail = errorSpy.mock.calls[0]?.[1];
    expect(typeof diagnosticDetail).toBe("string");
    expect(diagnosticDetail).toContain("more issue(s) omitted");
    expect(diagnosticDetail.length).toBeLessThanOrEqual(243);
    errorSpy.mockRestore();
  });

  it("validates account command group AccountDto responses", async () => {
    const invalidAccountDto = { id: "acc-1", kind: "Local" };
    const accountCommandCases = [
      ["add_account", () => addAccount("Local", "Local")],
      ["update_account_sync", () => updateAccountSync("acc-1", 3600, true, false, 30)],
      ["update_account_credentials", () => updateAccountCredentials("acc-1", "https://example.com", "user", "secret")],
      ["rename_account", () => renameAccount("acc-1", "Renamed")],
      ["test_account_connection", () => testAccountConnection("acc-1")],
    ] as const;

    setupTauriMocks((cmd) => {
      if (accountCommandCases.some(([command]) => command === cmd)) {
        return invalidAccountDto;
      }
      return null;
    });

    for (const [command, runCommand] of accountCommandCases) {
      const result = await runCommand();
      expect(Result.isFailure(result), command).toBe(true);
      const error = Result.unwrapError(result);
      expect(error.type).toBe("Diagnostics");
      expect(error.message).toContain("validation failed");
    }
  });

  it("validates account command group sync status responses", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "get_account_sync_status") {
        return {
          last_success_at: null,
          last_error: null,
          error_count: -1,
          next_retry_at: null,
        };
      }
      return null;
    });

    const result = await getAccountSyncStatus("acc-1");

    expect(Result.isFailure(result)).toBe(true);
    const error = Result.unwrapError(result);
    expect(error.type).toBe("Diagnostics");
    expect(error.message).toContain("validation failed");
  });

  it("validates account command group null responses", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "delete_account") {
        return { ok: true };
      }
      return null;
    });

    const result = await deleteAccount("acc-1");

    expect(Result.isFailure(result)).toBe(true);
    const error = Result.unwrapError(result);
    expect(error.type).toBe("Diagnostics");
    expect(error.message).toContain("validation failed");
  });

  it("validates article command group ArticleDto responses", async () => {
    const invalidArticleDto = {
      id: "article-1",
      feed_id: "feed-1",
      title: "Article",
      content_sanitized: "",
      summary: null,
      url: "   ",
      author: null,
      published_at: "2026-05-10T01:00:00Z",
      thumbnail: null,
      is_read: false,
      is_starred: false,
    };
    const articleCommandCases = [
      ["list_articles", () => listArticles("feed-1")],
      ["list_account_articles", () => listAccountArticles("acc-1")],
      ["list_folder_articles", () => listFolderArticles("folder-1")],
      ["list_starred_articles", () => listStarredArticles("acc-1")],
      ["list_recent_articles", () => listRecentArticles("acc-1")],
      ["search_articles", () => searchArticles("acc-1", "query")],
      ["list_articles_by_tag", () => listArticlesByTag("tag-1")],
    ] as const;

    setupTauriMocks((cmd) => {
      if (articleCommandCases.some(([command]) => command === cmd)) {
        return [invalidArticleDto];
      }
      return null;
    });

    for (const [command, runCommand] of articleCommandCases) {
      const result = await runCommand();
      expect(Result.isFailure(result), command).toBe(true);
      const error = Result.unwrapError(result);
      expect(error.type).toBe("Diagnostics");
      expect(error.message).toContain("validation failed");
    }
  });

  it("validates article command group null responses", async () => {
    const articleNullCommandCases = [
      ["mark_account_read", () => markAccountRead("acc-1")],
      ["mark_account_starred_read", () => markAccountStarredRead("acc-1")],
      ["mark_article_read", () => markArticleRead("article-1")],
      ["record_article_view", () => recordArticleView("acc-1", "article-1")],
      ["mark_feed_read", () => markFeedRead("feed-1")],
      ["mark_folder_read", () => markFolderRead("folder-1")],
      ["unstar_account_articles", () => unstarAccountArticles("acc-1")],
    ] as const;

    setupTauriMocks((cmd) => {
      if (articleNullCommandCases.some(([command]) => command === cmd)) {
        return { ok: true };
      }
      return null;
    });

    for (const [command, runCommand] of articleNullCommandCases) {
      const result = await runCommand();
      expect(Result.isFailure(result), command).toBe(true);
      const error = Result.unwrapError(result);
      expect(error.type).toBe("Diagnostics");
      expect(error.message).toContain("validation failed");
    }
  });

  it("validates database command group DatabaseInfo responses", async () => {
    const databaseCommandCases = [
      ["get_database_info", () => getDatabaseInfo()],
      ["vacuum_database", () => vacuumDatabase()],
    ] as const;

    setupTauriMocks((cmd) => {
      if (databaseCommandCases.some(([command]) => command === cmd)) {
        return {
          db_size_bytes: 100,
          wal_size_bytes: 20,
          shm_size_bytes: 0,
          total_size_bytes: 10,
        };
      }
      return null;
    });

    for (const [command, runCommand] of databaseCommandCases) {
      const result = await runCommand();
      expect(Result.isFailure(result), command).toBe(true);
      const error = Result.unwrapError(result);
      expect(error.type).toBe("Diagnostics");
      expect(error.message).toContain("validation failed");
    }
  });

  it("validates feed command group responses", async () => {
    const invalidFeedDto = {
      id: "feed-1",
      account_id: "acc-1",
      folder_id: null,
      remote_id: null,
      title: "Feed",
      url: "https://example.com/feed.xml",
      site_url: "https://example.com",
      unread_count: -1,
      reader_mode: "inherit",
      web_preview_mode: "inherit",
    };
    const feedCommandCases = [
      ["list_feeds", () => listFeeds("acc-1")],
      ["add_local_feed", () => addLocalFeed("acc-1", "https://example.com/feed.xml")],
    ] as const;

    setupTauriMocks((cmd) => {
      if (cmd === "list_feeds") {
        return [invalidFeedDto];
      }
      if (cmd === "add_local_feed") {
        return invalidFeedDto;
      }
      return null;
    });

    for (const [command, runCommand] of feedCommandCases) {
      const result = await runCommand();
      expect(Result.isFailure(result), command).toBe(true);
      const error = Result.unwrapError(result);
      expect(error.type).toBe("Diagnostics");
      expect(error.message).toContain("validation failed");
    }
  });

  it("validates feed command group null responses", async () => {
    const feedNullCommandCases = [
      ["delete_feed", () => deleteFeed("feed-1")],
      ["rename_feed", () => renameFeed("feed-1", "Renamed")],
      ["update_feed_folder", () => updateFeedFolder("feed-1", null)],
      ["update_feed_display_settings", () => updateFeedDisplaySettings("feed-1", "inherit", "off")],
    ] as const;

    setupTauriMocks((cmd) => {
      if (feedNullCommandCases.some(([command]) => command === cmd)) {
        return { ok: true };
      }
      return null;
    });

    for (const [command, runCommand] of feedNullCommandCases) {
      const result = await runCommand();
      expect(Result.isFailure(result), command).toBe(true);
      const error = Result.unwrapError(result);
      expect(error.type).toBe("Diagnostics");
      expect(error.message).toContain("validation failed");
    }
  });

  it("validates folder command group FolderDto responses", async () => {
    const invalidFolderDto = {
      id: "folder-1",
      account_id: "acc-1",
      name: "Folder",
      sort_order: -1,
    };
    const folderCommandCases = [
      ["list_folders", () => listFolders("acc-1")],
      ["create_folder", () => createFolder("acc-1", "Folder")],
    ] as const;

    setupTauriMocks((cmd) => {
      if (cmd === "list_folders") {
        return [invalidFolderDto];
      }
      if (cmd === "create_folder") {
        return invalidFolderDto;
      }
      return null;
    });

    for (const [command, runCommand] of folderCommandCases) {
      const result = await runCommand();
      expect(Result.isFailure(result), command).toBe(true);
      const error = Result.unwrapError(result);
      expect(error.type).toBe("Diagnostics");
      expect(error.message).toContain("validation failed");
    }
  });

  it("validates mute keyword command group DTO responses", async () => {
    const invalidMuteKeywordDto = {
      id: "mute-1",
      keyword: "   ",
      scope: "title_and_body",
      created_at: "2026-04-15",
      updated_at: "2026-04-15T01:00:00Z",
    };
    const muteKeywordCommandCases = [
      ["list_mute_keywords", () => listMuteKeywords()],
      ["create_mute_keyword", () => createMuteKeyword("Kindle Unlimited", "title")],
      ["update_mute_keyword", () => updateMuteKeyword("mute-1", "body")],
    ] as const;

    setupTauriMocks((cmd) => {
      if (cmd === "list_mute_keywords") {
        return [invalidMuteKeywordDto];
      }
      if (cmd === "create_mute_keyword" || cmd === "update_mute_keyword") {
        return invalidMuteKeywordDto;
      }
      return null;
    });

    for (const [command, runCommand] of muteKeywordCommandCases) {
      const result = await runCommand();
      expect(Result.isFailure(result), command).toBe(true);
      const error = Result.unwrapError(result);
      expect(error.type).toBe("Diagnostics");
      expect(error.message).toContain("validation failed");
    }
  });

  it("validates tag command group DTO responses", async () => {
    const invalidTagDto = {
      id: "tag-1",
      name: "   ",
      color: "#123456",
    };
    const tagCommandCases = [
      ["list_tags", () => listTags()],
      ["create_tag", () => createTag("Research", "#123456")],
      ["rename_tag", () => renameTag("tag-1", "Research", "#123456")],
      ["get_article_tags", () => getArticleTags("article-1")],
    ] as const;

    setupTauriMocks((cmd) => {
      if (cmd === "list_tags" || cmd === "get_article_tags") {
        return [invalidTagDto];
      }
      if (cmd === "create_tag" || cmd === "rename_tag") {
        return invalidTagDto;
      }
      return null;
    });

    for (const [command, runCommand] of tagCommandCases) {
      const result = await runCommand();
      expect(Result.isFailure(result), command).toBe(true);
      const error = Result.unwrapError(result);
      expect(error.type).toBe("Diagnostics");
      expect(error.message).toContain("validation failed");
    }
  });

  it("validates tag command group null responses", async () => {
    const tagNullCommandCases = [
      ["delete_tag", () => deleteTag("tag-1")],
      ["tag_article", () => tagArticle("article-1", "tag-1")],
      ["untag_article", () => untagArticle("article-1", "tag-1")],
    ] as const;

    setupTauriMocks((cmd) => {
      if (tagNullCommandCases.some(([command]) => command === cmd)) {
        return { ok: true };
      }
      return null;
    });

    for (const [command, runCommand] of tagNullCommandCases) {
      const result = await runCommand();
      expect(Result.isFailure(result), command).toBe(true);
      const error = Result.unwrapError(result);
      expect(error.type).toBe("Diagnostics");
      expect(error.message).toContain("validation failed");
    }
  });

  it("validates browser webview command group state responses", async () => {
    const browserStateCommandCases = [
      [
        "create_or_update_browser_webview",
        () => createOrUpdateBrowserWebview("https://example.com", responseValidationBrowserBounds),
      ],
      ["go_back_browser_webview", () => goBackBrowserWebview()],
      ["go_forward_browser_webview", () => goForwardBrowserWebview()],
      ["reload_browser_webview", () => reloadBrowserWebview()],
    ] as const;

    setupTauriMocks((cmd) => {
      if (browserStateCommandCases.some(([command]) => command === cmd)) {
        return {
          url: "https://example.com",
          can_go_back: "false",
          can_go_forward: false,
          is_loading: false,
        };
      }
      return null;
    });

    for (const [command, runCommand] of browserStateCommandCases) {
      const result = await runCommand();
      expect(Result.isFailure(result), command).toBe(true);
      const error = Result.unwrapError(result);
      expect(error.type).toBe("Diagnostics");
      expect(error.message).toContain("validation failed");
    }
  });

  it("validates browser webview command group null responses", async () => {
    const browserNullCommandCases = [
      ["set_browser_webview_bounds", () => setBrowserWebviewBounds(responseValidationBrowserBounds)],
      ["focus_browser_webview", () => focusBrowserWebview()],
      ["close_browser_webview", () => closeBrowserWebview()],
    ] as const;

    setupTauriMocks((cmd) => {
      if (browserNullCommandCases.some(([command]) => command === cmd)) {
        return { ok: true };
      }
      return null;
    });

    for (const [command, runCommand] of browserNullCommandCases) {
      const result = await runCommand();
      expect(Result.isFailure(result), command).toBe(true);
      const error = Result.unwrapError(result);
      expect(error.type).toBe("Diagnostics");
      expect(error.message).toContain("validation failed");
    }
  });

  it("validates getPreferences responses with known-key value schemas", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "get_preferences") {
        return {
          theme: "light",
          shortcut_next_article: "Shift+J",
          selected_account_id: "acc-1",
        };
      }
      return null;
    });

    expect(Result.unwrap(await getPreferences())).toEqual({
      theme: "light",
      shortcut_next_article: "Shift+J",
      selected_account_id: "acc-1",
    });
  });

  it("rejects malformed getPreferences responses", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "get_preferences") {
        return {
          theme: null,
        };
      }
      return null;
    });

    const result = await getPreferences();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).type).toBe("Diagnostics");
    expect(Result.unwrapError(result).message).toContain("validation failed");
  });
});

describe("safeInvoke args validation", () => {
  it("keeps args schema parse errors user-facing while response schema parse errors stay diagnostics-only", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_accounts") return [{ id: "acc-1" }];
      return null;
    });

    const argsResult = await listFeeds("   ");
    const responseResult = await listAccounts();

    expect(Result.unwrapError(argsResult)).toMatchObject({
      type: "UserVisible",
      message: expect.stringContaining("Command validation failed:"),
    });
    expect(Result.unwrapError(responseResult)).toEqual({
      type: "Diagnostics",
      message: "Response validation failed. See diagnostics for details.",
    });
  });

  it("rejects blank command ids before invoking Tauri", async () => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === "list_feeds") {
        invoked = true;
      }
      return null;
    });

    const result = await listFeeds("   ");

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toMatchObject({
      type: "UserVisible",
      message: "Command validation failed: accountId: Command id must not be blank",
    });
    expect(invoked).toBe(false);
  });

  it.each([
    ["accountId", "list_folders", () => listFolders("   ")],
    ["accountId", "list_feeds", () => listFeeds("   ")],
    ["feedId", "list_articles", () => listArticles("   ")],
    ["accountId", "list_account_articles", () => listAccountArticles("   ")],
    ["folderId", "list_folder_articles", () => listFolderArticles("   ")],
    ["accountId", "list_starred_articles", () => listStarredArticles("   ")],
    ["accountId", "list_recent_articles", () => listRecentArticles("   ")],
    ["accountId", "count_account_unread_articles", () => countAccountUnreadArticles("   ")],
    ["accountId", "count_account_starred_articles", () => countAccountStarredArticles("   ")],
    ["accountId", "mark_account_read", () => markAccountRead("   ")],
    ["accountId", "mark_account_starred_read", () => markAccountStarredRead("   ")],
    ["targetId", "count_old_unread_articles", () => countOldUnreadArticles("feed", "   ", 7)],
    ["targetId", "mark_old_unread_read", () => markOldUnreadRead("feed", "   ", 7)],
    ["accountId", "unstar_account_articles", () => unstarAccountArticles("   ")],
    ["accountId", "search_articles", () => searchArticles("   ", "rust")],
    ["articleId", "mark_article_read", () => markArticleRead("   ")],
    ["accountId", "record_article_view", () => recordArticleView("   ", "article-1")],
    ["articleId", "record_article_view", () => recordArticleView("acc-1", "   ")],
    ["accountId", "clear_article_view_history", () => clearArticleViewHistory("   ")],
    ["articleIds.0", "mark_articles_read", () => markArticlesRead(["   "])],
    ["articleId", "toggle_article_star", () => toggleArticleStar("   ", true)],
    ["feedId", "mark_feed_read", () => markFeedRead("   ")],
    ["folderId", "mark_folder_read", () => markFolderRead("   ")],
    ["accountId", "update_account_sync", () => updateAccountSync("   ", 3600, true, false, 30)],
    ["accountId", "update_account_credentials", () => updateAccountCredentials("   ", "https://example.com", "alice")],
    ["accountId", "rename_account", () => renameAccount("   ", "Local")],
    ["accountId", "test_account_connection", () => testAccountConnection("   ")],
    ["accountId", "delete_account", () => deleteAccount("   ")],
    ["accountId", "get_account_sync_status", () => getAccountSyncStatus("   ")],
    ["accountId", "add_local_feed", () => addLocalFeed("   ", "https://example.com/feed.xml")],
    ["accountId", "create_folder", () => createFolder("   ", "Reading")],
    ["feedId", "delete_feed", () => deleteFeed("   ")],
    ["feedId", "rename_feed", () => renameFeed("   ", "Title")],
    ["feedId", "update_feed_folder", () => updateFeedFolder("   ", "folder-1")],
    ["feedId", "update_feed_display_settings", () => updateFeedDisplaySettings("   ", "inherit", "inherit")],
    ["accountId", "export_opml", () => exportOpml("   ")],
    ["tagId", "rename_tag", () => renameTag("   ", "News")],
    ["tagId", "delete_tag", () => deleteTag("   ")],
    ["articleId", "tag_article", () => tagArticle("   ", "tag-1")],
    ["tagId", "tag_article", () => tagArticle("article-1", "   ")],
    ["articleId", "untag_article", () => untagArticle("   ", "tag-1")],
    ["tagId", "untag_article", () => untagArticle("article-1", "   ")],
    ["articleId", "get_article_tags", () => getArticleTags("   ")],
    ["tagId", "list_articles_by_tag", () => listArticlesByTag("   ")],
    ["accountId", "list_articles_by_tag", () => listArticlesByTag("tag-1", undefined, undefined, "   ")],
    ["muteKeywordId", "update_mute_keyword", () => updateMuteKeyword("   ", "title")],
    ["muteKeywordId", "delete_mute_keyword", () => deleteMuteKeyword("   ")],
  ] as const)("rejects blank %s for %s before invoking Tauri", async (fieldName, commandName, runCommand) => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === commandName) {
        invoked = true;
      }
      return null;
    });

    const result = await runCommand();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result)).toMatchObject({
      type: "UserVisible",
      message: `Command validation failed: ${fieldName}: Command id must not be blank`,
    });
    expect(invoked).toBe(false);
  });

  it("accepts setPreference values that match known preference schemas", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "set_preference") {
        expect(args).toEqual({ key: "theme", value: "dark" });
        return null;
      }
      return null;
    });

    Result.unwrap(await setPreference("theme", "dark"));
  });

  it("rejects invalid values for known preference keys before invoking Tauri", async () => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === "set_preference") {
        invoked = true;
      }
      return null;
    });

    const result = await setPreference("theme", "midnight");

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toContain("Invalid value for preference key: theme");
    expect(invoked).toBe(false);
  });

  it("keeps unknown preference keys as string passthrough for backend validation", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "set_preference") {
        expect(args).toEqual({ key: "selected_account_id", value: "acc-1" });
        return null;
      }
      return null;
    });

    Result.unwrap(await setPreference("selected_account_id", "acc-1"));
  });

  it("accepts known shortcut preference keys with saved shortcut values", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "set_preference") {
        expect(args).toEqual({
          key: "shortcut_next_article",
          value: "Shift+J",
        });
        return null;
      }
      return null;
    });

    Result.unwrap(await setPreference("shortcut_next_article", "Shift+J"));
  });

  it("rejects unknown shortcut preference keys before invoking Tauri", async () => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === "set_preference") {
        invoked = true;
      }
      return null;
    });

    const result = await setPreference("shortcut_unknown_action", "x");

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toContain("Invalid preference key: shortcut_unknown_action");
    expect(invoked).toBe(false);
  });

  it("rejects empty shortcut preference values before invoking Tauri", async () => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === "set_preference") {
        invoked = true;
      }
      return null;
    });

    const result = await setPreference("shortcut_next_article", "   ");

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toContain("Invalid value for preference key: shortcut_next_article");
    expect(invoked).toBe(false);
  });

  it("accepts Reading List http URLs including quote characters", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "add_to_reading_list") {
        expect(args).toEqual({
          url: 'https://example.com/article?title="quoted"',
        });
        return null;
      }
      return null;
    });

    Result.unwrap(await addToReadingList('https://example.com/article?title="quoted"'));
  });

  it("trims Reading List URLs before invoking Tauri", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "add_to_reading_list") {
        expect(args).toEqual({
          url: "https://example.com/article",
        });
        return null;
      }
      return null;
    });

    Result.unwrap(await addToReadingList(" https://example.com/article "));
  });

  it("trims open-in-browser command args before invoking Tauri", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "open_in_browser") {
        expect(args).toEqual({
          url: "https://example.com/article",
          background: false,
        });
        return null;
      }
      return null;
    });

    Result.unwrap(await openInBrowser(" https://example.com/article ", false));
  });

  it("normalizes blank update-feed-folder ids to null before invoking Tauri", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "update_feed_folder") {
        expect(args).toEqual({
          feedId: "feed-1",
          folderId: null,
        });
        return null;
      }
      return null;
    });

    Result.unwrap(await updateFeedFolder("feed-1", "   "));
  });

  it("trims update-feed-folder ids before invoking Tauri", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "update_feed_folder") {
        expect(args).toEqual({
          feedId: "feed-1",
          folderId: "folder-1",
        });
        return null;
      }
      return null;
    });

    Result.unwrap(await updateFeedFolder("feed-1", " folder-1 "));
  });

  it("normalizes blank startup sync preferred account ids to undefined before invoking Tauri", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "trigger_startup_sync") {
        expect(args).toEqual({
          preferredAccountId: undefined,
        });
        return {
          synced: false,
          total: 0,
          succeeded: 0,
          failed: [],
          warnings: [],
        };
      }
      return null;
    });

    Result.unwrap(await triggerStartupSync("   "));
  });

  it("trims startup sync preferred account ids before invoking Tauri", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "trigger_startup_sync") {
        expect(args).toEqual({
          preferredAccountId: "acc-1",
        });
        return {
          synced: true,
          total: 1,
          succeeded: 1,
          failed: [],
          warnings: [],
        };
      }
      return null;
    });

    Result.unwrap(await triggerStartupSync(" acc-1 "));
  });

  it("trims account credential URL and username but preserves password text before invoking Tauri", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "update_account_credentials") {
        expect(args).toEqual({
          accountId: "acc-1",
          serverUrl: "https://example.com",
          username: "user",
          password: " secret ",
        });
        return sampleAccounts[0];
      }
      return null;
    });

    Result.unwrap(await updateAccountCredentials("acc-1", " https://example.com ", " user ", " secret "));
  });

  it.each([
    "",
    "   ",
  ] as const)("allows account credential password %j without trimming before invoking Tauri", async (password) => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "update_account_credentials") {
        expect(args).toEqual({
          accountId: "acc-1",
          serverUrl: "https://example.com",
          username: "user",
          password,
        });
        return sampleAccounts[0];
      }
      return null;
    });

    Result.unwrap(await updateAccountCredentials("acc-1", "https://example.com", "user", password));
  });

  it.each([
    ["serverUrl", () => updateAccountCredentials("acc-1", "   ", "user", "secret")],
    ["username", () => updateAccountCredentials("acc-1", "https://example.com", "   ", "secret")],
  ] as const)("rejects blank account credential %s before invoking Tauri", async (_field, runCommand) => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === "update_account_credentials") {
        invoked = true;
      }
      return null;
    });

    const result = await runCommand();

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toContain("validation failed");
    expect(invoked).toBe(false);
  });

  it("passes nonblank clipboard text without trimming before invoking Tauri", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "copy_to_clipboard") {
        expect(args).toEqual({
          text: " copied text ",
        });
        return null;
      }
      return null;
    });

    Result.unwrap(await copyToClipboard(" copied text "));
  });

  it.each(["", "   "])("rejects blank clipboard text %j before invoking Tauri", async (text) => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === "copy_to_clipboard") {
        invoked = true;
      }
      return null;
    });

    const result = await copyToClipboard(text);

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toContain("validation failed");
    expect(invoked).toBe(false);
  });

  it.each([
    "",
    "   ",
    "https://example.com/article\nnext",
    "mailto:hello@example.com",
    "file:///tmp/article.html",
  ])("rejects invalid open-in-browser URL %j before invoking Tauri", async (url) => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === "open_in_browser") {
        invoked = true;
      }
      return null;
    });

    const result = await openInBrowser(url, false);

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toContain("validation failed");
    expect(invoked).toBe(false);
  });

  it("rejects blank create folder names before invoking Tauri", async () => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === "create_folder") {
        invoked = true;
      }
      return null;
    });

    const result = await createFolder("acc-1", "   ");

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toContain("validation failed");
    expect(invoked).toBe(false);
  });

  it("rejects blank article search queries before invoking Tauri", async () => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === "search_articles") {
        invoked = true;
      }
      return null;
    });

    const result = await searchArticles("acc-1", "   ");

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toContain("validation failed");
    expect(invoked).toBe(false);
  });

  it("trims article search queries before invoking Tauri", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "search_articles") {
        expect(args).toEqual({
          accountId: "acc-1",
          query: "fresh",
          offset: undefined,
          limit: undefined,
        });
        return [];
      }
      return null;
    });

    Result.unwrap(await searchArticles("acc-1", " fresh "));
  });

  it("rejects Reading List newline URLs before invoking Tauri", async () => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === "add_to_reading_list") {
        invoked = true;
      }
      return null;
    });

    const result = await addToReadingList("https://example.com/article\nnext");

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toContain("validation failed");
    expect(invoked).toBe(false);
  });

  it("rejects Reading List non-http URLs before invoking Tauri", async () => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === "add_to_reading_list") {
        invoked = true;
      }
      return null;
    });

    const result = await addToReadingList("mailto:hello@example.com");

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toContain("validation failed");
    expect(invoked).toBe(false);
  });

  it("opens mailto links through the external URL command boundary", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "plugin:opener|open_url") {
        expect(args).toEqual({
          url: "mailto:?subject=First&body=https%3A%2F%2Fexample.com",
        });
        return null;
      }
      return null;
    });

    Result.unwrap(await openExternalUrl("mailto:?subject=First&body=https%3A%2F%2Fexample.com"));
  });

  it("trims external URL command args before invoking Tauri", async () => {
    setupTauriMocks((cmd, args) => {
      if (cmd === "plugin:opener|open_url") {
        expect(args).toEqual({
          url: "https://example.com/article",
        });
        return null;
      }
      return null;
    });

    Result.unwrap(await openExternalUrl(" https://example.com/article "));
  });

  it("rejects unsupported external URL schemes before invoking Tauri", async () => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === "plugin:opener|open_url") {
        invoked = true;
      }
      return null;
    });

    const result = await openExternalUrl("file:///tmp/article.html");

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toContain("validation failed");
    expect(invoked).toBe(false);
  });
});

describe("setupTauriMocks validates args for custom handler", () => {
  it("passes validated args to custom handler", async () => {
    setupTauriMocks((cmd) => {
      if (cmd === "list_articles") return [];
      return null;
    });
    const ok = Result.unwrap(await listArticles("feed-1"));
    expect(ok).toEqual([]);
  });

  it("rejects invalid direct invoke args before custom handlers can coerce them", async () => {
    let invoked = false;
    setupTauriMocks((cmd) => {
      if (cmd === "mark_article_read") {
        invoked = true;
      }
      return null;
    });

    await expect(invoke("mark_article_read", { articleId: 123 })).rejects.toThrow();
    expect(invoked).toBe(false);
  });
});
