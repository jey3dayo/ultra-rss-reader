import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AccountDtoSchema,
  AccountSyncStatusSchema,
  AppErrorSchema,
  ArticleDtoSchema,
  addAccountArgs,
  addToReadingListArgs,
  BrowserWebviewStateSchema,
  browserWebviewBoundsArgs,
  commandArgsSchemas,
  countAccountStarredArticlesArgs,
  createMuteKeywordArgs,
  DiscoveredFeedDtoSchema,
  deleteMuteKeywordArgs,
  FeedArticleSummaryDtoSchema,
  FeedDtoSchema,
  FolderDtoSchema,
  listArticlesArgs,
  listArticlesByTagArgs,
  listFeedArticleSummariesArgs,
  listFolderArticlesArgs,
  listRecentArticlesArgs,
  listStarredArticlesArgs,
  MuteKeywordDtoSchema,
  markArticleReadArgs,
  oldUnreadArticlesArgs,
  PlatformInfoSchema,
  setMuteAutoMarkReadArgs,
  TagArticleCountsSchema,
  TagDtoSchema,
  toggleArticleStarArgs,
  UpdateInfoDtoSchema,
} from "@/api/schemas";

function readTauriCommandsSource() {
  return readFileSync(join(process.cwd(), "src/api/tauri-commands.ts"), "utf8");
}

function extractSafeInvokeCalls(source: string) {
  const calls: string[] = [];
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const start = source.indexOf("safeInvoke(", searchFrom);
    if (start === -1) {
      break;
    }

    let depth = 0;
    let end = start;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === "(") {
        depth += 1;
      } else if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          calls.push(source.slice(start, end + 1));
          break;
        }
      }
    }

    searchFrom = end + 1;
  }

  return calls;
}

function extractSafeInvokeCommandsWithArgs(source: string) {
  const commands = extractSafeInvokeCalls(source)
    .filter((call) => /\bargs\s*:/.test(call))
    .map((call) => {
      const match = call.match(/safeInvoke\(\s*"([^"]+)"/);
      return match?.[1];
    })
    .filter((command): command is string => typeof command === "string");

  return [...new Set(commands)].sort();
}

describe("DTO schemas", () => {
  it("parses valid AccountDto", () => {
    const data = {
      id: "acc-1",
      kind: "local",
      name: "Local",
      server_url: null,
      username: null,
      sync_interval_secs: 3600,
      sync_on_startup: true,
      sync_on_wake: false,
      keep_read_items_days: 30,
    };
    expect(AccountDtoSchema.parse(data)).toEqual(data);
  });
  it("parses valid AccountSyncStatusDto", () => {
    const data = {
      last_success_at: "2026-04-15T01:00:00Z",
      last_error: null,
      error_count: 0,
      next_retry_at: null,
    };
    expect(AccountSyncStatusSchema.parse(data)).toEqual(data);
  });
  it("rejects AccountDto with missing fields", () => {
    expect(() => AccountDtoSchema.parse({ id: "acc-1" })).toThrow();
  });
  it("parses valid FolderDto", () => {
    const data = { id: "f-1", account_id: "acc-1", name: "Tech", sort_order: 0 };
    expect(FolderDtoSchema.parse(data)).toEqual(data);
  });
  it("parses valid FeedDto", () => {
    const data = {
      id: "feed-1",
      account_id: "acc-1",
      folder_id: null,
      title: "Blog",
      url: "https://example.com/feed.xml",
      site_url: "https://example.com",
      unread_count: 5,
      reader_mode: "on",
      web_preview_mode: "off",
    };
    expect(FeedDtoSchema.parse(data)).toEqual(data);
  });
  it("rejects invalid feed unread counts", () => {
    const data = {
      id: "feed-1",
      account_id: "acc-1",
      folder_id: null,
      title: "Blog",
      url: "https://example.com/feed.xml",
      site_url: "https://example.com",
      unread_count: 0,
      reader_mode: "on",
      web_preview_mode: "off",
    };

    expect(() => FeedDtoSchema.parse({ ...data, unread_count: -1 })).toThrow();
    expect(() => FeedDtoSchema.parse({ ...data, unread_count: 1.5 })).toThrow();
  });
  it("parses valid FeedArticleSummaryDto", () => {
    const data = {
      feed_id: "feed-1",
      latest_article_at: "2026-04-01T10:00:00Z",
      starred_count: 2,
    };
    expect(FeedArticleSummaryDtoSchema.parse(data)).toEqual(data);
    expect(FeedArticleSummaryDtoSchema.parse({ ...data, latest_article_at: null })).toEqual({
      ...data,
      latest_article_at: null,
    });
  });
  it("rejects invalid feed summary starred counts", () => {
    const data = {
      feed_id: "feed-1",
      latest_article_at: "2026-04-01T10:00:00Z",
      starred_count: 0,
    };

    expect(() => FeedArticleSummaryDtoSchema.parse({ ...data, starred_count: -1 })).toThrow();
    expect(() => FeedArticleSummaryDtoSchema.parse({ ...data, starred_count: 1.5 })).toThrow();
  });
  it("parses valid ArticleDto", () => {
    const data = {
      id: "art-1",
      feed_id: "feed-1",
      title: "Hello",
      content_sanitized: "<p>Hi</p>",
      summary: null,
      url: null,
      author: null,
      published_at: "2026-03-25T10:00:00Z",
      thumbnail: null,
      is_read: false,
      is_starred: false,
    };
    expect(ArticleDtoSchema.parse(data)).toEqual(data);
  });
  it("parses valid TagDto", () => {
    expect(TagDtoSchema.parse({ id: "tag-1", name: "Important", color: "#ff0000" })).toEqual({
      id: "tag-1",
      name: "Important",
      color: "#ff0000",
    });
  });
  it("parses TagDto with null color", () => {
    expect(TagDtoSchema.parse({ id: "tag-1", name: "Important", color: null })).toEqual({
      id: "tag-1",
      name: "Important",
      color: null,
    });
  });
  it("rejects invalid tag article counts", () => {
    expect(() => TagArticleCountsSchema.parse({ "tag-1": -1 })).toThrow();
    expect(() => TagArticleCountsSchema.parse({ "tag-1": 1.5 })).toThrow();
  });
  it("parses valid MuteKeywordDto", () => {
    const data = {
      id: "mute-1",
      keyword: "Kindle Unlimited",
      scope: "title_and_body",
      created_at: "2026-04-15T01:00:00Z",
      updated_at: "2026-04-15T01:00:00Z",
    };
    expect(MuteKeywordDtoSchema.parse(data)).toEqual(data);
  });
  it("parses valid DiscoveredFeedDto", () => {
    expect(DiscoveredFeedDtoSchema.parse({ url: "https://example.com/feed.xml", title: "Blog" })).toEqual({
      url: "https://example.com/feed.xml",
      title: "Blog",
    });
  });
  it("parses valid UpdateInfoDto", () => {
    expect(UpdateInfoDtoSchema.parse({ version: "1.0.0", body: "Release notes" })).toEqual({
      version: "1.0.0",
      body: "Release notes",
    });
  });
  it("parses UpdateInfoDto with null body", () => {
    expect(UpdateInfoDtoSchema.parse({ version: "1.0.0", body: null })).toEqual({ version: "1.0.0", body: null });
  });
  it("parses platform info response", () => {
    const data = {
      kind: "windows",
      capabilities: {
        supports_reading_list: false,
        supports_background_browser_open: false,
        supports_runtime_window_icon_replacement: true,
        supports_native_browser_navigation: true,
        uses_dev_file_credentials: false,
      },
    };
    expect(PlatformInfoSchema.parse(data)).toEqual(data);
  });
});

describe("AppErrorSchema", () => {
  it("parses UserVisible error", () => {
    expect(AppErrorSchema.parse({ type: "UserVisible", message: "Something went wrong" })).toEqual({
      type: "UserVisible",
      message: "Something went wrong",
    });
  });
  it("parses Retryable error", () => {
    expect(AppErrorSchema.parse({ type: "Retryable", message: "Network timeout" })).toEqual({
      type: "Retryable",
      message: "Network timeout",
    });
  });
  it("rejects unknown error type", () => {
    expect(() => AppErrorSchema.parse({ type: "Unknown", message: "?" })).toThrow();
  });
});

describe("BrowserWebviewStateSchema", () => {
  it("accepts an empty string URL as the backend state value", () => {
    expect(
      BrowserWebviewStateSchema.parse({
        url: "",
        can_go_back: false,
        can_go_forward: false,
        is_loading: false,
      }),
    ).toEqual({
      url: "",
      can_go_back: false,
      can_go_forward: false,
      is_loading: false,
    });
  });

  it("accepts a relative URL as the backend state value", () => {
    expect(
      BrowserWebviewStateSchema.parse({
        url: "/reader/article",
        can_go_back: false,
        can_go_forward: true,
        is_loading: true,
      }),
    ).toEqual({
      url: "/reader/article",
      can_go_back: false,
      can_go_forward: true,
      is_loading: true,
    });
  });

  it("accepts an HTTP URL as the backend state value", () => {
    expect(
      BrowserWebviewStateSchema.parse({
        url: "http://example.com/article",
        can_go_back: true,
        can_go_forward: false,
        is_loading: false,
      }),
    ).toEqual({
      url: "http://example.com/article",
      can_go_back: true,
      can_go_forward: false,
      is_loading: false,
    });
  });
});

describe("command args schemas", () => {
  it("parses listArticlesArgs", () => {
    expect(listArticlesArgs.parse({ feedId: "f-1" })).toEqual({ feedId: "f-1" });
  });
  it("parses listArticlesArgs with optional fields", () => {
    expect(listArticlesArgs.parse({ feedId: "f-1", offset: 0, limit: 20 })).toEqual({
      feedId: "f-1",
      offset: 0,
      limit: 20,
    });
  });
  it("rejects listArticlesArgs with missing feedId", () => {
    expect(() => listArticlesArgs.parse({})).toThrow();
  });
  it("parses markArticleReadArgs with optional read", () => {
    expect(markArticleReadArgs.parse({ articleId: "a-1" })).toEqual({ articleId: "a-1" });
  });
  it("parses listStarredArticlesArgs", () => {
    expect(listStarredArticlesArgs.parse({ accountId: "acc-1", offset: 0, limit: 20 })).toEqual({
      accountId: "acc-1",
      offset: 0,
      limit: 20,
    });
  });
  it("parses listRecentArticlesArgs with mode", () => {
    expect(listRecentArticlesArgs.parse({ accountId: "acc-1", mode: "unread", offset: 0, limit: 20 })).toEqual({
      accountId: "acc-1",
      mode: "unread",
      offset: 0,
      limit: 20,
    });
  });
  it("parses countAccountStarredArticlesArgs", () => {
    expect(countAccountStarredArticlesArgs.parse({ accountId: "acc-1" })).toEqual({ accountId: "acc-1" });
  });
  it("parses oldUnreadArticlesArgs and rejects arbitrary periods", () => {
    expect(oldUnreadArticlesArgs.parse({ scopeKind: "feed", targetId: "feed-1", olderThanDays: 30 })).toEqual({
      scopeKind: "feed",
      targetId: "feed-1",
      olderThanDays: 30,
    });
    expect(() => oldUnreadArticlesArgs.parse({ scopeKind: "feed", targetId: "feed-1", olderThanDays: 14 })).toThrow();
  });
  it("parses toggleArticleStarArgs", () => {
    expect(toggleArticleStarArgs.parse({ articleId: "a-1", starred: true })).toEqual({
      articleId: "a-1",
      starred: true,
    });
  });
  it("parses addAccountArgs", () => {
    expect(addAccountArgs.parse({ kind: "local", name: "Test" })).toEqual({ kind: "local", name: "Test" });
  });
  it("parses createMuteKeywordArgs", () => {
    expect(createMuteKeywordArgs.parse({ keyword: "Kindle Unlimited", scope: "title" })).toEqual({
      keyword: "Kindle Unlimited",
      scope: "title",
    });
  });
  it("parses deleteMuteKeywordArgs", () => {
    expect(deleteMuteKeywordArgs.parse({ muteKeywordId: "mute-1" })).toEqual({ muteKeywordId: "mute-1" });
  });
  it("parses setMuteAutoMarkReadArgs", () => {
    expect(setMuteAutoMarkReadArgs.parse({ enabled: true })).toEqual({ enabled: true });
  });
  it("parses listFolderArticlesArgs", () => {
    expect(listFolderArticlesArgs.parse({ folderId: "folder-1", mode: "starred", offset: 0, limit: 50 })).toEqual({
      folderId: "folder-1",
      mode: "starred",
      offset: 0,
      limit: 50,
    });
  });
  it("parses listFeedArticleSummariesArgs", () => {
    expect(listFeedArticleSummariesArgs.parse({ accountId: "acc-1" })).toEqual({ accountId: "acc-1" });
  });
  it("parses listArticlesByTagArgs with mode", () => {
    expect(listArticlesByTagArgs.parse({ tagId: "tag-1", mode: "starred", accountId: "acc-1" })).toEqual({
      tagId: "tag-1",
      mode: "starred",
      accountId: "acc-1",
    });
  });
  it("parses finite browser webview bounds and rejects invalid dimensions", () => {
    expect(browserWebviewBoundsArgs.parse({ x: 0.5, y: -12, width: 320, height: 240 })).toEqual({
      x: 0.5,
      y: -12,
      width: 320,
      height: 240,
    });
    expect(() => browserWebviewBoundsArgs.parse({ x: Number.NaN, y: 0, width: 320, height: 240 })).toThrow();
    expect(() =>
      browserWebviewBoundsArgs.parse({ x: 0, y: Number.POSITIVE_INFINITY, width: 320, height: 240 }),
    ).toThrow();
    expect(() => browserWebviewBoundsArgs.parse({ x: 0, y: 0, width: 0, height: 240 })).toThrow();
    expect(() => browserWebviewBoundsArgs.parse({ x: 0, y: 0, width: 320, height: -1 })).toThrow();
  });
  it("accepts only http or https Reading List URLs without CR/LF", () => {
    expect(addToReadingListArgs.parse({ url: "http://example.com/article" })).toEqual({
      url: "http://example.com/article",
    });
    expect(
      addToReadingListArgs.parse({
        url: 'https://example.com/article?title="quoted"',
      }),
    ).toEqual({
      url: 'https://example.com/article?title="quoted"',
    });
    expect(() => addToReadingListArgs.parse({ url: "mailto:hello@example.com" })).toThrow();
    expect(() => addToReadingListArgs.parse({ url: "ftp://example.com/article" })).toThrow();
    expect(() => addToReadingListArgs.parse({ url: "https://example.com/article\nnext" })).toThrow();
    expect(() => addToReadingListArgs.parse({ url: "https://example.com/article\rnext" })).toThrow();
  });
  it("commandArgsSchemas maps command names to schemas", () => {
    expect(commandArgsSchemas.list_articles).toBeDefined();
    expect(commandArgsSchemas.list_folder_articles).toBeDefined();
    expect(commandArgsSchemas.list_feed_article_summaries).toBeDefined();
    expect(commandArgsSchemas.mark_article_read).toBeDefined();
    expect(commandArgsSchemas.count_old_unread_articles).toBeDefined();
    expect(commandArgsSchemas.mark_old_unread_read).toBeDefined();
    expect(commandArgsSchemas.unstar_account_articles).toBeDefined();
    expect(commandArgsSchemas.create_mute_keyword).toBeDefined();
    expect(commandArgsSchemas.delete_mute_keyword).toBeDefined();
    expect(commandArgsSchemas.set_mute_auto_mark_read).toBeDefined();
    expect(commandArgsSchemas.list_accounts).toBeUndefined(); // no args
  });

  it("keeps every safeInvoke args schema registered by command name", () => {
    const commandsWithArgs = extractSafeInvokeCommandsWithArgs(readTauriCommandsSource());

    expect(Object.keys(commandArgsSchemas).sort()).toEqual(commandsWithArgs);
  });
});
