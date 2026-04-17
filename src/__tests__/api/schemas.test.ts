import { describe, expect, it } from "vitest";
import {
  AccountDtoSchema,
  AccountSyncStatusSchema,
  AppErrorSchema,
  ArticleDtoSchema,
  addAccountArgs,
  commandArgsSchemas,
  countAccountStarredArticlesArgs,
  createMuteKeywordArgs,
  DiscoveredFeedDtoSchema,
  deleteMuteKeywordArgs,
  FeedDtoSchema,
  FolderDtoSchema,
  listArticlesArgs,
  listStarredArticlesArgs,
  MuteKeywordDtoSchema,
  markArticleReadArgs,
  PlatformInfoSchema,
  setMuteAutoMarkReadArgs,
  TagDtoSchema,
  toggleArticleStarArgs,
  UpdateInfoDtoSchema,
} from "@/api/schemas";

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
  it("parses countAccountStarredArticlesArgs", () => {
    expect(countAccountStarredArticlesArgs.parse({ accountId: "acc-1" })).toEqual({ accountId: "acc-1" });
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
  it("commandArgsSchemas maps command names to schemas", () => {
    expect(commandArgsSchemas.list_articles).toBeDefined();
    expect(commandArgsSchemas.mark_article_read).toBeDefined();
    expect(commandArgsSchemas.create_mute_keyword).toBeDefined();
    expect(commandArgsSchemas.delete_mute_keyword).toBeDefined();
    expect(commandArgsSchemas.set_mute_auto_mark_read).toBeDefined();
    expect(commandArgsSchemas.list_accounts).toBeUndefined(); // no args
  });
});
