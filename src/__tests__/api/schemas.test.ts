import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractSafeInvokeCommandsWithArgs } from "@tests/helpers/tauri-command-contract";
import { describe, expect, it } from "vitest";
import {
  AccountDtoSchema,
  AccountSyncStatusSchema,
  AppErrorSchema,
  ArticleDtoSchema,
  addAccountArgs,
  addLocalFeedArgs,
  addToReadingListArgs,
  BooleanResponseSchema,
  BrowserWebviewStateSchema,
  browserWebviewBoundsArgs,
  type CommandWithArgs,
  CountResponseSchema,
  commandArgsSchemas,
  countAccountStarredArticlesArgs,
  createFolderArgs,
  createMuteKeywordArgs,
  DevRuntimeOptionsSchema,
  DiscoveredFeedDtoSchema,
  deleteMuteKeywordArgs,
  discoverFeedsArgs,
  FeedArticleSummaryDtoSchema,
  FeedDtoSchema,
  FolderDtoSchema,
  getCommandArgsSchema,
  IntResponseSchema,
  isCommandWithArgs,
  listAccountArticlesArgs,
  listArticlesArgs,
  listArticlesByTagArgs,
  listFeedArticleSummariesArgs,
  listFolderArticlesArgs,
  listRecentArticlesArgs,
  listStarredArticlesArgs,
  MAX_IPC_PAGINATION_LIMIT,
  MuteKeywordDtoSchema,
  markArticleReadArgs,
  markArticlesReadArgs,
  NonnegativeIntResponseSchema,
  NullableStarredCountSchema,
  NullResponseSchema,
  oldUnreadArticlesArgs,
  openExternalUrlArgs,
  PlatformInfoSchema,
  PreferencesDtoSchema,
  StringResponseSchema,
  SyncResultSchema,
  searchArticlesArgs,
  setMuteAutoMarkReadArgs,
  setPreferenceArgs,
  TagArticleCountsSchema,
  TagDtoSchema,
  toggleArticleStarArgs,
  UpdateInfoDtoSchema,
  updateAccountSyncArgs,
  updateFeedFolderArgs,
} from "@/api/schemas";
import { MAX_DEV_WINDOW_DIMENSION_PX } from "@/api/schemas/platform-info";
import { UpdateDownloadProgressEventPayloadSchema } from "@/api/schemas/update-info";

function readTauriCommandsSource() {
  return readFileSync(join(process.cwd(), "src/api/tauri-commands.ts"), "utf8");
}

function readRustCommandDtoSource() {
  return readFileSync(join(process.cwd(), "src-tauri/src/commands/dto.rs"), "utf8");
}

function readRustArticleCommandSource() {
  return readFileSync(join(process.cwd(), "src-tauri/src/commands/article_commands.rs"), "utf8");
}

function readRustTagCommandSource() {
  return readFileSync(join(process.cwd(), "src-tauri/src/commands/tag_commands.rs"), "utf8");
}

function readRustPlatformCommandSource() {
  return readFileSync(join(process.cwd(), "src-tauri/src/commands/platform_commands.rs"), "utf8");
}

function extractRustUsizeConst(source: string, constName: string) {
  const match = source.match(new RegExp(`const ${constName}: usize = (\\d+);`));
  expect(match, `${constName} should exist`).not.toBeNull();
  return Number(match?.[1]);
}

function extractRustU32Const(source: string, constName: string) {
  const match = source.match(new RegExp(`const ${constName}: u32 = ([\\d_]+);`));
  expect(match, `${constName} should exist`).not.toBeNull();
  return Number(match?.[1].replaceAll("_", ""));
}

function extractRustStructFields(source: string, structName: string) {
  const structMatch = source.match(new RegExp(`pub struct ${structName} \\{([\\s\\S]*?)\\n\\}`));
  expect(structMatch, `${structName} should exist in Rust command DTOs`).not.toBeNull();

  return [...(structMatch?.[1] ?? "").matchAll(/^ {4}pub ([a-zA-Z0-9_]+):/gm)].map((match) => match[1]).sort();
}

function expectPaginationArgsSchema(schema: { parse: (value: unknown) => unknown }, base: Record<string, unknown>) {
  expect(schema.parse({ ...base, offset: 0, limit: 1 })).toEqual({
    ...base,
    offset: 0,
    limit: 1,
  });
  expect(schema.parse({ ...base, offset: 0, limit: MAX_IPC_PAGINATION_LIMIT })).toEqual({
    ...base,
    offset: 0,
    limit: MAX_IPC_PAGINATION_LIMIT,
  });
  expect(() => schema.parse({ ...base, offset: -1, limit: 1 })).toThrow();
  expect(() => schema.parse({ ...base, offset: 0.5, limit: 1 })).toThrow();
  expect(() => schema.parse({ ...base, offset: Number.NaN, limit: 1 })).toThrow();
  expect(() => schema.parse({ ...base, offset: 0, limit: 0 })).toThrow();
  expect(() => schema.parse({ ...base, offset: 0, limit: MAX_IPC_PAGINATION_LIMIT + 1 })).toThrow();
  expect(() => schema.parse({ ...base, offset: 0, limit: 1.5 })).toThrow();
  expect(() => schema.parse({ ...base, offset: 0, limit: Number.POSITIVE_INFINITY })).toThrow();
}

describe("DTO schemas", () => {
  it("parses valid AccountDto", () => {
    const data = {
      id: "acc-1",
      kind: "local",
      name: "Local",
      display_name: "Local",
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
  it("keeps account sync status error counts nonnegative integers", () => {
    const data = {
      last_success_at: null,
      last_error: "network",
      error_count: 0,
      next_retry_at: null,
    };

    expect(AccountSyncStatusSchema.parse({ ...data, error_count: 1 })).toEqual({
      ...data,
      error_count: 1,
    });
    expect(() => AccountSyncStatusSchema.parse({ ...data, error_count: -1 })).toThrow();
    expect(() => AccountSyncStatusSchema.parse({ ...data, error_count: 0.5 })).toThrow();
    expect(() =>
      AccountSyncStatusSchema.parse({
        ...data,
        error_count: Number.POSITIVE_INFINITY,
      }),
    ).toThrow();
  });
  it("keeps account sync status datetimes as offset ISO strings when present", () => {
    const data = {
      last_success_at: "2026-04-15T01:00:00+09:00",
      last_error: null,
      error_count: 0,
      next_retry_at: "2026-04-15T02:00:00Z",
    };

    expect(AccountSyncStatusSchema.parse(data)).toEqual(data);
    expect(() =>
      AccountSyncStatusSchema.parse({
        ...data,
        last_success_at: "2026-04-15",
      }),
    ).toThrow();
    expect(() =>
      AccountSyncStatusSchema.parse({
        ...data,
        next_retry_at: "2026-04-15T02:00:00",
      }),
    ).toThrow();
    expect(() =>
      AccountSyncStatusSchema.parse({
        ...data,
        next_retry_at: "not-a-date",
      }),
    ).toThrow();
  });
  it("rejects AccountDto with missing fields", () => {
    expect(() => AccountDtoSchema.parse({ id: "acc-1" })).toThrow();
  });
  it("normalizes AccountDto identity fields and rejects blank identity values", () => {
    const data = {
      id: " acc-1 ",
      kind: " local ",
      name: " Local ",
      display_name: " Local ",
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
    };

    expect(AccountDtoSchema.parse(data)).toEqual({
      ...data,
      id: "acc-1",
      kind: "local",
      name: "Local",
      display_name: "Local",
    });
    expect(() => AccountDtoSchema.parse({ ...data, id: "" })).toThrow();
    expect(() => AccountDtoSchema.parse({ ...data, kind: "   " })).toThrow();
    expect(() => AccountDtoSchema.parse({ ...data, name: "\t" })).toThrow();
  });
  it("normalizes blank optional AccountDto display names to undefined", () => {
    const data = {
      id: "acc-1",
      kind: "local",
      name: "Local",
      display_name: "   ",
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
    };

    expect(AccountDtoSchema.parse(data)).toEqual({
      ...data,
      display_name: undefined,
    });
  });
  it("keeps AccountDto sync numeric fields aligned with command args", () => {
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

    expect(AccountDtoSchema.parse({ ...data, sync_interval_secs: 60 })).toEqual({
      ...data,
      sync_interval_secs: 60,
    });
    expect(AccountDtoSchema.parse({ ...data, keep_read_items_days: 3650 })).toEqual({
      ...data,
      keep_read_items_days: 3650,
    });
    expect(() => AccountDtoSchema.parse({ ...data, sync_interval_secs: 59 })).toThrow();
    expect(() => AccountDtoSchema.parse({ ...data, sync_interval_secs: 86_401 })).toThrow();
    expect(() => AccountDtoSchema.parse({ ...data, sync_interval_secs: 60.5 })).toThrow();
    expect(() =>
      AccountDtoSchema.parse({
        ...data,
        sync_interval_secs: Number.POSITIVE_INFINITY,
      }),
    ).toThrow();
    expect(() => AccountDtoSchema.parse({ ...data, keep_read_items_days: 0 })).toThrow();
    expect(() => AccountDtoSchema.parse({ ...data, keep_read_items_days: 3651 })).toThrow();
    expect(() => AccountDtoSchema.parse({ ...data, keep_read_items_days: 30.5 })).toThrow();
    expect(() =>
      AccountDtoSchema.parse({
        ...data,
        keep_read_items_days: Number.POSITIVE_INFINITY,
      }),
    ).toThrow();
  });
  it("keeps AccountDto schema fields aligned with Rust DTO fields", () => {
    expect(Object.keys(AccountDtoSchema.shape).sort()).toEqual(
      extractRustStructFields(readRustCommandDtoSource(), "AccountDto"),
    );
  });
  it("keeps AccountSyncStatus schema fields aligned with Rust DTO fields", () => {
    expect(Object.keys(AccountSyncStatusSchema.shape).sort()).toEqual(
      extractRustStructFields(readRustCommandDtoSource(), "AccountSyncStatus"),
    );
  });
  it("parses valid FolderDto", () => {
    const data = {
      id: "f-1",
      account_id: "acc-1",
      name: "Tech",
      sort_order: 0,
    };
    expect(FolderDtoSchema.parse(data)).toEqual(data);
  });
  it("rejects blank FolderDto identity and display fields", () => {
    const data = {
      id: "f-1",
      account_id: "acc-1",
      name: "Tech",
      sort_order: 0,
    };

    expect(() => FolderDtoSchema.parse({ ...data, id: "" })).toThrow();
    expect(() => FolderDtoSchema.parse({ ...data, id: "   " })).toThrow();
    expect(() => FolderDtoSchema.parse({ ...data, account_id: "" })).toThrow();
    expect(() => FolderDtoSchema.parse({ ...data, account_id: "   " })).toThrow();
    expect(() => FolderDtoSchema.parse({ ...data, name: "" })).toThrow();
    expect(() => FolderDtoSchema.parse({ ...data, name: "   " })).toThrow();
  });
  it("keeps FolderDto sort_order as a nonnegative integer order value", () => {
    const data = {
      id: "f-1",
      account_id: "acc-1",
      name: "Tech",
      sort_order: 0,
    };

    expect(FolderDtoSchema.parse({ ...data, sort_order: 1 })).toEqual({
      ...data,
      sort_order: 1,
    });
    expect(() => FolderDtoSchema.parse({ ...data, sort_order: -1 })).toThrow();
    expect(() => FolderDtoSchema.parse({ ...data, sort_order: 0.5 })).toThrow();
    expect(() => FolderDtoSchema.parse({ ...data, sort_order: Number.POSITIVE_INFINITY })).toThrow();
  });
  it("parses valid FeedDto", () => {
    const data = {
      id: "feed-1",
      account_id: "acc-1",
      folder_id: null,
      remote_id: "feed/https://example.com/feed.xml",
      title: "Blog",
      url: "https://example.com/feed.xml",
      site_url: "https://example.com",
      unread_count: 5,
      reader_mode: "on",
      web_preview_mode: "off",
    };
    expect(FeedDtoSchema.parse(data)).toEqual(data);
  });
  it("rejects FeedDto blank identity and title fields", () => {
    const data = {
      id: "feed-1",
      account_id: "acc-1",
      folder_id: null,
      remote_id: null,
      title: "Blog",
      url: "https://example.com/feed.xml",
      site_url: "https://example.com",
      unread_count: 0,
      reader_mode: "on",
      web_preview_mode: "off",
    };

    expect(() => FeedDtoSchema.parse({ ...data, id: "" })).toThrow();
    expect(() => FeedDtoSchema.parse({ ...data, id: "   " })).toThrow();
    expect(() => FeedDtoSchema.parse({ ...data, account_id: "" })).toThrow();
    expect(() => FeedDtoSchema.parse({ ...data, account_id: "   " })).toThrow();
    expect(() => FeedDtoSchema.parse({ ...data, title: "" })).toThrow();
    expect(() => FeedDtoSchema.parse({ ...data, title: "   " })).toThrow();
  });
  it("rejects FeedDto invalid and non-http feed URLs", () => {
    const data = {
      id: "feed-1",
      account_id: "acc-1",
      folder_id: null,
      remote_id: null,
      title: "Blog",
      url: "https://example.com/feed.xml",
      site_url: "https://example.com",
      unread_count: 0,
      reader_mode: "on",
      web_preview_mode: "off",
    };

    expect(() => FeedDtoSchema.parse({ ...data, url: "" })).toThrow();
    expect(() => FeedDtoSchema.parse({ ...data, url: "   " })).toThrow();
    expect(() => FeedDtoSchema.parse({ ...data, url: " https://example.com/feed.xml " })).toThrow();
    expect(() => FeedDtoSchema.parse({ ...data, url: "https://" })).toThrow();
    expect(() => FeedDtoSchema.parse({ ...data, url: "ftp://example.com/feed.xml" })).toThrow();
    expect(() => FeedDtoSchema.parse({ ...data, url: "mailto:feed@example.com" })).toThrow();
    expect(() =>
      FeedDtoSchema.parse({
        ...data,
        url: "https://example.com/feed.xml\nnext",
      }),
    ).toThrow();
    expect(FeedDtoSchema.parse({ ...data, site_url: "" })).toEqual({
      ...data,
      site_url: "",
    });
    expect(() => FeedDtoSchema.parse({ ...data, site_url: "   " })).toThrow();
    expect(() => FeedDtoSchema.parse({ ...data, site_url: " https://example.com " })).toThrow();
    expect(() => FeedDtoSchema.parse({ ...data, site_url: "ftp://example.com" })).toThrow();
  });
  it("keeps FeedDto schema fields aligned with Rust DTO fields", () => {
    expect(Object.keys(FeedDtoSchema.shape).sort()).toEqual(
      extractRustStructFields(readRustCommandDtoSource(), "FeedDto"),
    );
  });
  it("rejects invalid feed unread counts", () => {
    const data = {
      id: "feed-1",
      account_id: "acc-1",
      folder_id: null,
      remote_id: null,
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
  it("normalizes ArticleDto URL fields and rejects blank strings", () => {
    const data = {
      id: "art-1",
      feed_id: "feed-1",
      title: "Hello",
      content_sanitized: "<p>Hi</p>",
      summary: null,
      url: " https://example.com/article ",
      author: null,
      published_at: "2026-03-25T10:00:00Z",
      thumbnail: " https://example.com/thumb.png ",
      is_read: false,
      is_starred: false,
    };

    expect(ArticleDtoSchema.parse(data)).toMatchObject({
      url: "https://example.com/article",
      thumbnail: "https://example.com/thumb.png",
    });
    expect(() => ArticleDtoSchema.parse({ ...data, url: "   " })).toThrow();
    expect(() => ArticleDtoSchema.parse({ ...data, thumbnail: "   " })).toThrow();
  });
  it("parses valid TagDto", () => {
    expect(
      TagDtoSchema.parse({
        id: "tag-1",
        name: " Important ",
        color: "#ff0000",
      }),
    ).toEqual({
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
  it("rejects invalid TagDto display fields", () => {
    expect(() => TagDtoSchema.parse({ id: "tag-1", name: "   ", color: null })).toThrow();
    expect(() => TagDtoSchema.parse({ id: "tag-1", name: "Important", color: "red" })).toThrow();
    expect(() => TagDtoSchema.parse({ id: "tag-1", name: "Important", color: "#fff" })).toThrow();
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
    expect(MuteKeywordDtoSchema.parse({ ...data, keyword: " Kindle Unlimited " })).toEqual(data);
  });
  it("rejects blank mute keyword DTO response keywords", () => {
    const data = {
      id: "mute-1",
      keyword: "Kindle Unlimited",
      scope: "title_and_body",
      created_at: "2026-04-15T01:00:00Z",
      updated_at: "2026-04-15T01:00:00Z",
    };

    expect(() => MuteKeywordDtoSchema.parse({ ...data, keyword: "" })).toThrow();
    expect(() => MuteKeywordDtoSchema.parse({ ...data, keyword: "   " })).toThrow();
  });
  it("rejects mute keyword DTO response timestamps without ISO datetime offsets", () => {
    const data = {
      id: "mute-1",
      keyword: "Kindle Unlimited",
      scope: "title_and_body",
      created_at: "2026-04-15T01:00:00Z",
      updated_at: "2026-04-15T01:00:00Z",
    };

    expect(() => MuteKeywordDtoSchema.parse({ ...data, created_at: "2026-04-15" })).toThrow();
    expect(() =>
      MuteKeywordDtoSchema.parse({
        ...data,
        created_at: "2026-04-15T01:00:00",
      }),
    ).toThrow();
    expect(() => MuteKeywordDtoSchema.parse({ ...data, updated_at: "not-a-date" })).toThrow();
  });
  it("parses valid DiscoveredFeedDto", () => {
    expect(
      DiscoveredFeedDtoSchema.parse({
        url: " https://example.com/feed.xml ",
        title: "",
      }),
    ).toEqual({
      url: "https://example.com/feed.xml",
      title: "",
    });
    expect(
      DiscoveredFeedDtoSchema.parse({
        url: "http://example.com/feed.xml",
        title: "Blog",
      }),
    ).toEqual({
      url: "http://example.com/feed.xml",
      title: "Blog",
    });
    expect(() => DiscoveredFeedDtoSchema.parse({ url: "   ", title: "Blog" })).toThrow();
    expect(() => DiscoveredFeedDtoSchema.parse({ url: "https://", title: "Blog" })).toThrow();
    expect(() =>
      DiscoveredFeedDtoSchema.parse({
        url: "mailto:hello@example.com",
        title: "Blog",
      }),
    ).toThrow();
    expect(() =>
      DiscoveredFeedDtoSchema.parse({
        url: "https://example.com/feed.xml\nnext",
        title: "Blog",
      }),
    ).toThrow();
  });
  it("parses valid UpdateInfoDto", () => {
    expect(UpdateInfoDtoSchema.parse({ version: " 1.0.0 ", body: "Release notes" })).toEqual({
      version: "1.0.0",
      body: "Release notes",
    });
  });
  it("keeps UpdateInfoDto body null or empty for updater UI compatibility", () => {
    expect(UpdateInfoDtoSchema.parse({ version: "1.0.0", body: null })).toEqual({ version: "1.0.0", body: null });
    expect(UpdateInfoDtoSchema.parse({ version: "1.0.0", body: "" })).toEqual({
      version: "1.0.0",
      body: "",
    });
  });
  it("rejects UpdateInfoDto with blank version", () => {
    expect(() => UpdateInfoDtoSchema.parse({ version: "", body: null })).toThrow();
    expect(() => UpdateInfoDtoSchema.parse({ version: "   ", body: null })).toThrow();
  });
  it("accepts finite updater progress event payloads and rejects malformed values", () => {
    expect(
      UpdateDownloadProgressEventPayloadSchema.parse({
        percent: 42,
        loaded: 100,
      }),
    ).toEqual({
      percent: 42,
      loaded: 100,
    });
    expect(UpdateDownloadProgressEventPayloadSchema.parse({ percent: null })).toEqual({ percent: null });
    expect(UpdateDownloadProgressEventPayloadSchema.safeParse({ percent: "42" }).success).toBe(false);
    expect(
      UpdateDownloadProgressEventPayloadSchema.safeParse({
        percent: Number.NaN,
      }).success,
    ).toBe(false);
    expect(
      UpdateDownloadProgressEventPayloadSchema.safeParse({
        percent: Number.POSITIVE_INFINITY,
      }).success,
    ).toBe(false);
    expect(UpdateDownloadProgressEventPayloadSchema.safeParse({ loaded: 100 }).success).toBe(false);
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
  it("keeps dev runtime window dimensions aligned with Rust command max", () => {
    const rustMaxDimension = extractRustU32Const(readRustPlatformCommandSource(), "MAX_DEV_WINDOW_DIMENSION_PX");

    expect(rustMaxDimension).toBe(MAX_DEV_WINDOW_DIMENSION_PX);
    expect(
      DevRuntimeOptionsSchema.parse({
        dev_intent: null,
        dev_web_url: null,
        dev_window_width: MAX_DEV_WINDOW_DIMENSION_PX,
        dev_window_height: null,
      }),
    ).toEqual({
      dev_intent: null,
      dev_web_url: null,
      dev_window_width: MAX_DEV_WINDOW_DIMENSION_PX,
      dev_window_height: null,
    });
    expect(() =>
      DevRuntimeOptionsSchema.parse({
        dev_intent: null,
        dev_web_url: null,
        dev_window_width: MAX_DEV_WINDOW_DIMENSION_PX + 1,
        dev_window_height: null,
      }),
    ).toThrow();
  });
});

describe("AppErrorSchema", () => {
  it("parses UserVisible error", () => {
    expect(
      AppErrorSchema.parse({
        type: "UserVisible",
        message: "Something went wrong",
      }),
    ).toEqual({
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
  it("rejects empty AppError messages", () => {
    expect(() => AppErrorSchema.parse({ type: "UserVisible", message: "" })).toThrow();
    expect(() => AppErrorSchema.parse({ type: "UserVisible", message: "   " })).toThrow();
    expect(() => AppErrorSchema.parse({ type: "Retryable", message: "" })).toThrow();
    expect(() => AppErrorSchema.parse({ type: "Retryable", message: "   " })).toThrow();
  });
});

describe("primitive command result schemas", () => {
  it("keeps primitive Tauri command result parsing strict", () => {
    expect(NullResponseSchema.parse(null)).toBeNull();
    expect(IntResponseSchema.parse(0)).toBe(0);
    expect(NonnegativeIntResponseSchema.parse(0)).toBe(0);
    expect(CountResponseSchema.parse(1)).toBe(1);
    expect(StringResponseSchema.parse("ok")).toBe("ok");
    expect(BooleanResponseSchema.parse(false)).toBe(false);

    expect(() => NullResponseSchema.parse(undefined)).toThrow();
    expect(() => IntResponseSchema.parse(1.5)).toThrow();
    expect(() => IntResponseSchema.parse(Number.NaN)).toThrow();
    expect(() => NonnegativeIntResponseSchema.parse(-1)).toThrow();
    expect(() => NonnegativeIntResponseSchema.parse(Number.NaN)).toThrow();
    expect(() => CountResponseSchema.parse(-1)).toThrow();
    expect(() => CountResponseSchema.parse(1.5)).toThrow();
    expect(() => StringResponseSchema.parse(1)).toThrow();
    expect(() => BooleanResponseSchema.parse("false")).toThrow();
  });

  it("keeps count and nonnegative integer response schemas separate", () => {
    expect(CountResponseSchema.parse(0)).toBe(0);
    expect(NonnegativeIntResponseSchema.parse(0)).toBe(0);
    expect(CountResponseSchema).not.toBe(NonnegativeIntResponseSchema);
  });
  it("normalizes nullable starred counts and rejects invalid count values", () => {
    expect(NullableStarredCountSchema.parse(null)).toBe(0);
    expect(NullableStarredCountSchema.parse(0)).toBe(0);
    expect(NullableStarredCountSchema.parse(2)).toBe(2);

    expect(() => NullableStarredCountSchema.parse(-1)).toThrow();
    expect(() => NullableStarredCountSchema.parse(1.5)).toThrow();
    expect(() => NullableStarredCountSchema.parse(Number.NaN)).toThrow();
    expect(() => NullableStarredCountSchema.parse(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("PreferencesDtoSchema", () => {
  it("accepts known, shortcut, and unknown string preference keys while rejecting invalid records", () => {
    expect(
      PreferencesDtoSchema.parse({
        theme: "dark",
        shortcut_next_article: "j",
        custom_backend_preference: "preserved",
        debug_web_preview_url: "",
      }),
    ).toEqual({
      theme: "dark",
      shortcut_next_article: "j",
      custom_backend_preference: "preserved",
      debug_web_preview_url: "",
    });

    expect(() => PreferencesDtoSchema.parse({ "": "blank" })).toThrow();
    expect(() => PreferencesDtoSchema.parse({ "   ": "blank" })).toThrow();
    expect(() => PreferencesDtoSchema.parse({ theme: null })).toThrow();
    expect(() => PreferencesDtoSchema.parse({ theme: true })).toThrow();
  });

  it("keeps API preference result parsing limited to string records", () => {
    expect(
      PreferencesDtoSchema.parse({
        theme: "midnight",
        shortcut_next_article: "   ",
        selected_account_id: "acc-1",
      }),
    ).toEqual({
      theme: "midnight",
      shortcut_next_article: "   ",
      selected_account_id: "acc-1",
    });

    expect(() => PreferencesDtoSchema.parse({ theme: 1 })).toThrow();
    expect(() => PreferencesDtoSchema.parse([])).toThrow();
    expect(() => PreferencesDtoSchema.parse(null)).toThrow();
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
    expect(listArticlesArgs.parse({ feedId: "f-1" })).toEqual({
      feedId: "f-1",
    });
  });
  it("parses listArticlesArgs with optional fields", () => {
    expect(listArticlesArgs.parse({ feedId: "f-1", offset: 0, limit: 20 })).toEqual({
      feedId: "f-1",
      offset: 0,
      limit: 20,
    });
  });
  it("accepts listArticlesArgs with a single article state filter", () => {
    expect(listArticlesArgs.parse({ feedId: "f-1", unreadOnly: true })).toEqual({
      feedId: "f-1",
      unreadOnly: true,
    });
    expect(listArticlesArgs.parse({ feedId: "f-1", starredOnly: true })).toEqual({
      feedId: "f-1",
      starredOnly: true,
    });
  });
  it("rejects listArticlesArgs with missing feedId", () => {
    expect(() => listArticlesArgs.parse({})).toThrow();
  });
  it("rejects listArticlesArgs with mutually exclusive filters", () => {
    expect(() =>
      listArticlesArgs.parse({
        feedId: "f-1",
        unreadOnly: true,
        starredOnly: true,
      }),
    ).toThrow("Article list filters are mutually exclusive");
  });
  it("parses markArticleReadArgs with optional read", () => {
    expect(markArticleReadArgs.parse({ articleId: "a-1" })).toEqual({
      articleId: "a-1",
    });
  });
  it("rejects empty bulk markArticlesReadArgs article id lists", () => {
    expect(markArticlesReadArgs.parse({ articleIds: ["a-1"] })).toEqual({
      articleIds: ["a-1"],
    });
    expect(() => markArticlesReadArgs.parse({ articleIds: [] })).toThrow();
  });
  it("parses listStarredArticlesArgs", () => {
    expect(
      listStarredArticlesArgs.parse({
        accountId: "acc-1",
        offset: 0,
        limit: 20,
      }),
    ).toEqual({
      accountId: "acc-1",
      offset: 0,
      limit: 20,
    });
  });
  it("parses listRecentArticlesArgs with mode", () => {
    expect(
      listRecentArticlesArgs.parse({
        accountId: "acc-1",
        mode: "unread",
        offset: 0,
        limit: 20,
      }),
    ).toEqual({
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
    expect(
      oldUnreadArticlesArgs.parse({
        scopeKind: "feed",
        targetId: "feed-1",
        olderThanDays: 30,
      }),
    ).toEqual({
      scopeKind: "feed",
      targetId: "feed-1",
      olderThanDays: 30,
    });
    expect(() =>
      oldUnreadArticlesArgs.parse({
        scopeKind: "feed",
        targetId: "feed-1",
        olderThanDays: 14,
      }),
    ).toThrow();
  });
  it("rejects oldUnreadArticlesArgs periods above the supported 90 day preset", () => {
    expect(
      oldUnreadArticlesArgs.parse({
        scopeKind: "feed",
        targetId: "feed-1",
        olderThanDays: 90,
      }),
    ).toEqual({
      scopeKind: "feed",
      targetId: "feed-1",
      olderThanDays: 90,
    });
    expect(() =>
      oldUnreadArticlesArgs.parse({
        scopeKind: "feed",
        targetId: "feed-1",
        olderThanDays: 91,
      }),
    ).toThrow();
  });
  it("parses toggleArticleStarArgs", () => {
    expect(toggleArticleStarArgs.parse({ articleId: "a-1", starred: true })).toEqual({
      articleId: "a-1",
      starred: true,
    });
  });
  it("parses addAccountArgs", () => {
    expect(addAccountArgs.parse({ kind: "Local", name: "Test" })).toEqual({
      kind: "Local",
      name: "Test",
    });
  });
  it("keeps addAccount provider args discriminated by provider kind", () => {
    expect(addAccountArgs.parse({ kind: "Local", name: "Test" })).toEqual({
      kind: "Local",
      name: "Test",
    });
    expect(
      addAccountArgs.parse({
        kind: "FreshRss",
        name: "FreshRSS",
        serverUrl: " https://rss.example.com ",
        username: " alice ",
        password: " secret ",
      }),
    ).toEqual({
      kind: "FreshRss",
      name: "FreshRSS",
      serverUrl: "https://rss.example.com",
      username: "alice",
      password: "secret",
    });
    expect(() => addAccountArgs.parse({ kind: "FreshRss", name: "FreshRSS" })).toThrow();
    expect(() =>
      addAccountArgs.parse({
        kind: "FreshRss",
        name: "FreshRSS",
        serverUrl: "",
        username: "alice",
        password: "pw",
      }),
    ).toThrow();
    expect(() =>
      addAccountArgs.parse({
        kind: "FreshRss",
        name: "FreshRSS",
        serverUrl: "https://rss.example.com",
        username: "   ",
        password: "pw",
      }),
    ).toThrow();
    expect(() => addAccountArgs.parse({ kind: "Unknown", name: "Test" })).toThrow();
  });
  it("trims and rejects blank feed URL command args", () => {
    expect(discoverFeedsArgs.parse({ url: " https://example.com/feed.xml " })).toEqual({
      url: "https://example.com/feed.xml",
    });
    expect(
      addLocalFeedArgs.parse({
        accountId: "acc-1",
        url: " https://example.com/feed.xml ",
      }),
    ).toEqual({
      accountId: "acc-1",
      url: "https://example.com/feed.xml",
    });

    expect(() => discoverFeedsArgs.parse({ url: "" })).toThrow();
    expect(() => discoverFeedsArgs.parse({ url: "   " })).toThrow();
    expect(() => addLocalFeedArgs.parse({ accountId: "acc-1", url: "" })).toThrow();
    expect(() => addLocalFeedArgs.parse({ accountId: "acc-1", url: "   " })).toThrow();
  });
  it("trims and rejects blank create folder names", () => {
    expect(
      createFolderArgs.parse({
        accountId: "acc-1",
        name: " Reading ",
      }),
    ).toEqual({
      accountId: "acc-1",
      name: "Reading",
    });

    expect(() => createFolderArgs.parse({ accountId: "acc-1", name: "" })).toThrow();
    expect(() => createFolderArgs.parse({ accountId: "acc-1", name: "   " })).toThrow();
  });
  it("validates updateAccountSyncArgs numeric range", () => {
    const valid = {
      accountId: "acc-1",
      syncIntervalSecs: 3600,
      syncOnStartup: true,
      syncOnWake: false,
      keepReadItemsDays: 30,
    };

    expect(updateAccountSyncArgs.parse(valid)).toEqual(valid);
    expect(updateAccountSyncArgs.parse({ ...valid, syncIntervalSecs: 60 })).toEqual({
      ...valid,
      syncIntervalSecs: 60,
    });
    expect(updateAccountSyncArgs.parse({ ...valid, keepReadItemsDays: 3650 })).toEqual({
      ...valid,
      keepReadItemsDays: 3650,
    });
    expect(() => updateAccountSyncArgs.parse({ ...valid, syncIntervalSecs: 59 })).toThrow();
    expect(() => updateAccountSyncArgs.parse({ ...valid, syncIntervalSecs: 86_401 })).toThrow();
    expect(() => updateAccountSyncArgs.parse({ ...valid, syncIntervalSecs: 60.5 })).toThrow();
    expect(() => updateAccountSyncArgs.parse({ ...valid, keepReadItemsDays: 0 })).toThrow();
    expect(() => updateAccountSyncArgs.parse({ ...valid, keepReadItemsDays: 3651 })).toThrow();
    expect(() => updateAccountSyncArgs.parse({ ...valid, keepReadItemsDays: 30.5 })).toThrow();
  });
  it("parses createMuteKeywordArgs", () => {
    expect(
      createMuteKeywordArgs.parse({
        keyword: "Kindle Unlimited",
        scope: "title",
      }),
    ).toEqual({
      keyword: "Kindle Unlimited",
      scope: "title",
    });
  });
  it("trims and rejects blank create mute keyword args", () => {
    expect(
      createMuteKeywordArgs.parse({
        keyword: " spoiler ",
        scope: "title",
      }),
    ).toEqual({
      keyword: "spoiler",
      scope: "title",
    });

    expect(() => createMuteKeywordArgs.parse({ keyword: "", scope: "title" })).toThrow();
    expect(() => createMuteKeywordArgs.parse({ keyword: "   ", scope: "title" })).toThrow();
  });
  it("parses deleteMuteKeywordArgs", () => {
    expect(deleteMuteKeywordArgs.parse({ muteKeywordId: "mute-1" })).toEqual({
      muteKeywordId: "mute-1",
    });
  });
  it("parses setMuteAutoMarkReadArgs", () => {
    expect(setMuteAutoMarkReadArgs.parse({ enabled: true })).toEqual({
      enabled: true,
    });
  });
  it("parses listFolderArticlesArgs", () => {
    expect(
      listFolderArticlesArgs.parse({
        folderId: "folder-1",
        mode: "starred",
        offset: 0,
        limit: 50,
      }),
    ).toEqual({
      folderId: "folder-1",
      mode: "starred",
      offset: 0,
      limit: 50,
    });
  });
  it("parses listFeedArticleSummariesArgs", () => {
    expect(listFeedArticleSummariesArgs.parse({ accountId: "acc-1" })).toEqual({
      accountId: "acc-1",
    });
  });
  it("normalizes updateFeedFolderArgs folder ids", () => {
    expect(updateFeedFolderArgs.parse({ feedId: "feed-1", folderId: null })).toEqual({
      feedId: "feed-1",
      folderId: null,
    });
    expect(updateFeedFolderArgs.parse({ feedId: "feed-1", folderId: "   " })).toEqual({
      feedId: "feed-1",
      folderId: null,
    });
    expect(updateFeedFolderArgs.parse({ feedId: "feed-1", folderId: " folder-1 " })).toEqual({
      feedId: "feed-1",
      folderId: "folder-1",
    });
  });
  it("parses listArticlesByTagArgs with mode", () => {
    expect(
      listArticlesByTagArgs.parse({
        tagId: "tag-1",
        mode: "starred",
        accountId: "acc-1",
      }),
    ).toEqual({
      tagId: "tag-1",
      mode: "starred",
      accountId: "acc-1",
    });
  });
  it("keeps API pagination args finite integer bounded", () => {
    expectPaginationArgsSchema(listArticlesArgs, { feedId: "feed-1" });
    expectPaginationArgsSchema(listAccountArticlesArgs, { accountId: "acc-1" });
    expectPaginationArgsSchema(listFolderArticlesArgs, {
      folderId: "folder-1",
    });
    expectPaginationArgsSchema(listStarredArticlesArgs, { accountId: "acc-1" });
    expectPaginationArgsSchema(listRecentArticlesArgs, { accountId: "acc-1" });
    expectPaginationArgsSchema(searchArticlesArgs, {
      accountId: "acc-1",
      query: "fresh",
    });
    expectPaginationArgsSchema(listArticlesByTagArgs, { tagId: "tag-1" });
  });
  it("trims and rejects blank search article queries", () => {
    expect(
      searchArticlesArgs.parse({
        accountId: "acc-1",
        query: " fresh ",
      }),
    ).toEqual({
      accountId: "acc-1",
      query: "fresh",
    });

    expect(() => searchArticlesArgs.parse({ accountId: "acc-1", query: "" })).toThrow();
    expect(() => searchArticlesArgs.parse({ accountId: "acc-1", query: "   " })).toThrow();
  });
  it("keeps IPC pagination limit schemas aligned with Rust command limits", () => {
    expect(extractRustUsizeConst(readRustArticleCommandSource(), "MAX_ARTICLE_COMMAND_LIST_LIMIT")).toBe(
      MAX_IPC_PAGINATION_LIMIT,
    );
    expect(extractRustUsizeConst(readRustTagCommandSource(), "MAX_TAG_ARTICLE_LIST_LIMIT")).toBe(
      MAX_IPC_PAGINATION_LIMIT,
    );
  });
  it("parses finite browser webview bounds and rejects invalid dimensions", () => {
    expect(
      browserWebviewBoundsArgs.parse({
        x: 0.5,
        y: -12,
        width: 320,
        height: 240,
      }),
    ).toEqual({
      x: 0.5,
      y: -12,
      width: 320,
      height: 240,
    });
    expect(() =>
      browserWebviewBoundsArgs.parse({
        x: Number.NaN,
        y: 0,
        width: 320,
        height: 240,
      }),
    ).toThrow();
    expect(() =>
      browserWebviewBoundsArgs.parse({
        x: 0,
        y: Number.POSITIVE_INFINITY,
        width: 320,
        height: 240,
      }),
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
    expect(
      addToReadingListArgs.parse({
        url: " https://example.com/article ",
      }),
    ).toEqual({
      url: "https://example.com/article",
    });
    expect(() => addToReadingListArgs.parse({ url: "mailto:hello@example.com" })).toThrow();
    expect(() => addToReadingListArgs.parse({ url: "ftp://example.com/article" })).toThrow();
    expect(() => addToReadingListArgs.parse({ url: "" })).toThrow();
    expect(() => addToReadingListArgs.parse({ url: "   " })).toThrow();
    expect(() => addToReadingListArgs.parse({ url: "https://example.com/article\nnext" })).toThrow();
    expect(() => addToReadingListArgs.parse({ url: "https://example.com/article\rnext" })).toThrow();
  });
  it("accepts mailto only at the external URL command boundary", () => {
    expect(
      openExternalUrlArgs.parse({
        url: "mailto:?subject=First&body=https%3A%2F%2Fexample.com",
      }),
    ).toEqual({
      url: "mailto:?subject=First&body=https%3A%2F%2Fexample.com",
    });
    expect(openExternalUrlArgs.parse({ url: "https://example.com/article" })).toEqual({
      url: "https://example.com/article",
    });
    expect(
      openExternalUrlArgs.parse({
        url: " mailto:?subject=First&body=https%3A%2F%2Fexample.com ",
      }),
    ).toEqual({
      url: "mailto:?subject=First&body=https%3A%2F%2Fexample.com",
    });
    expect(openExternalUrlArgs.parse({ url: " https://example.com/article " })).toEqual({
      url: "https://example.com/article",
    });
    expect(() => openExternalUrlArgs.parse({ url: "ftp://example.com/article" })).toThrow();
    expect(() => openExternalUrlArgs.parse({ url: "" })).toThrow();
    expect(() => openExternalUrlArgs.parse({ url: "   " })).toThrow();
    expect(() => openExternalUrlArgs.parse({ url: "mailto:?subject=First\nbody=Bad" })).toThrow();
  });
  it("accepts only http or https open-in-browser URLs without CR/LF", () => {
    expect(
      commandArgsSchemas.open_in_browser.parse({
        url: " https://example.com/article ",
        background: true,
      }),
    ).toEqual({
      url: "https://example.com/article",
      background: true,
    });
    expect(() => commandArgsSchemas.open_in_browser.parse({ url: "" })).toThrow();
    expect(() => commandArgsSchemas.open_in_browser.parse({ url: "   " })).toThrow();
    expect(() =>
      commandArgsSchemas.open_in_browser.parse({
        url: "https://example.com/article\nnext",
      }),
    ).toThrow();
    expect(() =>
      commandArgsSchemas.open_in_browser.parse({
        url: "mailto:hello@example.com",
      }),
    ).toThrow();
    expect(() =>
      commandArgsSchemas.open_in_browser.parse({
        url: "file:///tmp/article.html",
      }),
    ).toThrow();
  });
  it("rejects unknown shortcut preference keys and validates known shortcut values", () => {
    expect(
      setPreferenceArgs.parse({
        key: "shortcut_next_article",
        value: "Shift+J",
      }),
    ).toEqual({
      key: "shortcut_next_article",
      value: "Shift+J",
    });
    expect(() => setPreferenceArgs.parse({ key: "shortcut_unknown_action", value: "x" })).toThrow();
    expect(() => setPreferenceArgs.parse({ key: "shortcut_next_article", value: "   " })).toThrow();
    expect(setPreferenceArgs.parse({ key: "selected_account_id", value: "acc-1" })).toEqual({
      key: "selected_account_id",
      value: "acc-1",
    });
  });
  it("validates known preference values while preserving backend-only and unknown passthrough keys", () => {
    expect(setPreferenceArgs.parse({ key: "theme", value: "dark" })).toEqual({
      key: "theme",
      value: "dark",
    });
    expect(setPreferenceArgs.parse({ key: "debug_web_preview_url", value: "" })).toEqual({
      key: "debug_web_preview_url",
      value: "",
    });
    expect(setPreferenceArgs.parse({ key: "selected_account_id", value: "" })).toEqual({
      key: "selected_account_id",
      value: "",
    });
    expect(setPreferenceArgs.parse({ key: "custom_backend_preference", value: "preserved" })).toEqual({
      key: "custom_backend_preference",
      value: "preserved",
    });

    expect(() => setPreferenceArgs.parse({ key: "theme", value: "sepia" })).toThrow();
    expect(() => setPreferenceArgs.parse({ key: "sync_on_startup", value: "yes" })).toThrow();
  });
  it("rejects non-displayable shortcut preference values", () => {
    expect(() => setPreferenceArgs.parse({ key: "shortcut_next_article", value: "k\n" })).toThrow();
    expect(() =>
      setPreferenceArgs.parse({
        key: "shortcut_next_article",
        value: "k\u0000",
      }),
    ).toThrow();
    expect(() =>
      setPreferenceArgs.parse({
        key: "shortcut_next_article",
        value: "\u001B",
      }),
    ).toThrow();
  });
  it("keeps preference value max length aligned to the backend UTF-8 byte limit", () => {
    const maxUtf8Value = `${"あ".repeat(341)}a`;

    expect(
      setPreferenceArgs.parse({
        key: "debug_web_preview_url",
        value: "a".repeat(1024),
      }),
    ).toEqual({
      key: "debug_web_preview_url",
      value: "a".repeat(1024),
    });
    expect(new TextEncoder().encode(maxUtf8Value).length).toBe(1024);
    expect(
      setPreferenceArgs.parse({
        key: "debug_web_preview_url",
        value: maxUtf8Value,
      }),
    ).toEqual({
      key: "debug_web_preview_url",
      value: maxUtf8Value,
    });
    expect(() =>
      setPreferenceArgs.parse({
        key: "debug_web_preview_url",
        value: "a".repeat(1025),
      }),
    ).toThrow();
    expect(() =>
      setPreferenceArgs.parse({
        key: "debug_web_preview_url",
        value: "あ".repeat(342),
      }),
    ).toThrow();
  });
  it("keeps sync result numeric fields nonnegative integers", () => {
    const valid = {
      synced: true,
      total: 2,
      succeeded: 1,
      failed: [],
      warnings: [
        {
          account_id: "acc-1",
          account_name: "FreshRSS",
          message: "Retry later",
          retry_in_seconds: 30,
        },
      ],
    };

    expect(SyncResultSchema.parse(valid)).toEqual(valid);
    expect(
      SyncResultSchema.parse({
        ...valid,
        failed: [
          {
            account_id: "acc-2",
            account_name: " FreshRSS ",
            message: " Network error ",
          },
        ],
        warnings: [
          {
            ...valid.warnings[0],
            account_name: " FreshRSS ",
            message: " Retry later ",
          },
        ],
      }),
    ).toEqual({
      ...valid,
      failed: [
        {
          account_id: "acc-2",
          account_name: "FreshRSS",
          message: "Network error",
        },
      ],
      warnings: [
        {
          ...valid.warnings[0],
          account_name: "FreshRSS",
          message: "Retry later",
        },
      ],
    });
    expect(() => SyncResultSchema.parse({ ...valid, total: -1 })).toThrow();
    expect(() => SyncResultSchema.parse({ ...valid, total: 1.5 })).toThrow();
    expect(() => SyncResultSchema.parse({ ...valid, succeeded: Number.POSITIVE_INFINITY })).toThrow();
    expect(
      SyncResultSchema.parse({
        ...valid,
        failed: [
          {
            account_id: "acc-2",
            account_name: "   ",
            message: "Network error",
          },
        ],
      }).failed[0]?.account_name,
    ).toBe("");
    expect(() =>
      SyncResultSchema.parse({
        ...valid,
        warnings: [{ ...valid.warnings[0], message: "   " }],
      }),
    ).toThrow();
    expect(() =>
      SyncResultSchema.parse({
        ...valid,
        warnings: [{ ...valid.warnings[0], retry_in_seconds: 0.5 }],
      }),
    ).toThrow();
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
    expect(getCommandArgsSchema("list_accounts")).toBeUndefined(); // no args
  });

  it("types command args schema lookup by known command names", () => {
    const knownCommand = "list_articles" satisfies CommandWithArgs;
    const unknownCommand = "list_accounts";
    const listArticlesSchema: typeof commandArgsSchemas.list_articles = getCommandArgsSchema(knownCommand);

    expect(listArticlesSchema).toBe(commandArgsSchemas.list_articles);
    expect(getCommandArgsSchema(unknownCommand)).toBeUndefined();
    expect(isCommandWithArgs(knownCommand)).toBe(true);
    expect(isCommandWithArgs(unknownCommand)).toBe(false);

    if (isCommandWithArgs(knownCommand)) {
      const narrowedCommand = knownCommand;
      expect(getCommandArgsSchema(knownCommand)).toBe(commandArgsSchemas.list_articles);
      expect(narrowedCommand).toBe(knownCommand);
    }
  });

  it("keeps every safeInvoke args schema registered by command name", () => {
    const commandsWithArgs = extractSafeInvokeCommandsWithArgs(readTauriCommandsSource());

    expect(Object.keys(commandArgsSchemas).sort()).toEqual(commandsWithArgs);
  });

  it("extracts safeInvoke args commands with stable sorting and duplicate removal", () => {
    expect(
      extractSafeInvokeCommandsWithArgs(`
        safeInvoke("zeta_command", { args: { id: "1" } });
        safeInvoke("alpha_command", { args: { id: "2" } });
        safeInvoke("no_args_command");
        safeInvoke("zeta_command", {
          args: {
            id: "3",
          },
        });
      `),
    ).toEqual(["alpha_command", "zeta_command"]);
  });
});
