import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expectSortedKeysForTarget } from "@tests/helpers/repo-contract-parser";
import { extractRustStructFields, extractSafeInvokeCommandsWithArgs } from "@tests/helpers/tauri-command-contract";
import { readTauriCommandsSource } from "@tests/helpers/tauri-command-source";
import type { BaseIssue, BaseSchema } from "valibot";
import { is, parse, safeParse, unwrap } from "valibot";
import { describe, expect, it } from "vitest";
import {
  AccountDtoSchema,
  AccountSyncStatusSchema,
  APP_ERROR_MESSAGE_MAX_CHARS,
  AppErrorSchema,
  ArticleDtoSchema,
  addAccountArgs,
  addLocalFeedArgs,
  addToReadingListArgs,
  BooleanResponseSchema,
  BrowserWebviewDiagnosticsPayloadSchema,
  BrowserWebviewFallbackPayloadSchema,
  BrowserWebviewStateSchema,
  browserWebviewBoundsArgs,
  COUNT_RESPONSE_MAX_VALUE,
  type CommandWithArgs,
  CountResponseSchema,
  clearArticleViewHistoryArgs,
  commandArgsSchemas,
  copyToClipboardArgs,
  countAccountStarredArticlesArgs,
  createFolderArgs,
  createMuteKeywordArgs,
  createSchemaVersionedQueryKey,
  DevRuntimeOptionsSchema,
  DiscoveredFeedDtoSchema,
  deleteAccountArgs,
  deleteFeedArgs,
  deleteMuteKeywordArgs,
  deleteTagArgs,
  discoverFeedsArgs,
  FeedArticleSummaryDtoSchema,
  FeedDtoSchema,
  FolderDtoSchema,
  FRONTEND_SCHEMA_CONTRACT_VERSION,
  getAccountSyncStatusArgs,
  getArticleTagsArgs,
  getCommandArgsSchema,
  IntResponseSchema,
  isCommandWithArgs,
  listAccountArticlesArgs,
  listArticlesArgs,
  listArticlesByTagArgs,
  listFeedArticleSummariesArgs,
  listFeedsArgs,
  listFolderArticlesArgs,
  listFoldersArgs,
  listRecentArticlesArgs,
  listStarredArticlesArgs,
  MAX_IPC_PAGINATION_LIMIT,
  MuteKeywordDtoSchema,
  markAccountReadArgs,
  markArticleReadArgs,
  markArticlesReadArgs,
  markFeedReadArgs,
  markFolderReadArgs,
  NonnegativeIntResponseSchema,
  NullableStarredCountSchema,
  NullResponseSchema,
  oldUnreadArticlesArgs,
  openExternalUrlArgs,
  PlatformInfoSchema,
  PreferencesDtoSchema,
  QUERY_CACHE_KEY_VERSION,
  recordArticleViewArgs,
  renameFeedArgs,
  renameTagArgs,
  SCHEMA_PARSE_FAILURE_ACTION_STATE,
  SettingsProfileImportResultSchema,
  SettingsProfileSchema,
  StringResponseSchema,
  SyncResultSchema,
  searchArticlesArgs,
  setMuteAutoMarkReadArgs,
  setPreferenceArgs,
  syncAccountArgs,
  syncFeedArgs,
  TagArticleCountsSchema,
  TagDtoSchema,
  tagArticleArgs,
  toggleArticleStarArgs,
  UpdateInfoDtoSchema,
  untagArticleArgs,
  updateAccountSyncArgs,
  updateFeedDisplaySettingsArgs,
  updateFeedFolderArgs,
  updateMuteKeywordArgs,
} from "@/api/schemas";
import {
  BROWSER_WEBVIEW_BOUNDS_MAX_VALUE,
  MAX_IPC_PAGINATION_OFFSET,
  SHARE_COMMAND_TEXT_MAX_CHARS,
} from "@/api/schemas/commands";
import { MAX_DEV_WINDOW_DIMENSION_PX } from "@/api/schemas/platform-info";
import { UpdateDownloadProgressEventPayloadSchema, UpdateReadyEventPayloadSchema } from "@/api/schemas/update-info";
import { objectEntries } from "@/api/schemas/validation";
import { APP_ACTIONS, isAppAction } from "@/lib/app-actions";

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

function readRustCommandSources() {
  return [
    "account_commands.rs",
    "article_commands.rs",
    "browser_webview_commands.rs",
    "database_commands.rs",
    "feed_commands.rs",
    "log_commands.rs",
    "local_account_sync_commands.rs",
    "mute_keyword_commands.rs",
    "opml_commands.rs",
    "platform_commands.rs",
    "preference_commands.rs",
    "settings_profile_commands.rs",
    "share_commands.rs",
    "sync_commands.rs",
    "tag_commands.rs",
    "updater_commands.rs",
  ]
    .map((fileName) => readFileSync(join(process.cwd(), "src-tauri/src/commands", fileName), "utf8"))
    .join("\n");
}

function extractRustTauriCommandNames(source: string) {
  const commands = new Set<string>();

  for (const match of source.matchAll(/#\[tauri::command\]\s+(?:pub\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)/g)) {
    const command = match[1];
    if (command) {
      commands.add(command);
    }
  }

  return [...commands].toSorted();
}

function extractRustUsizeConst(source: string, constName: string) {
  const match = source.match(new RegExp(`(?:pub\\(crate\\)\\s+)?const ${constName}: usize = ([\\d_]+);`));
  expect(match, `${constName} should exist`).not.toBeNull();
  return Number(match?.[1].replaceAll("_", ""));
}

function extractRustI64Const(source: string, constName: string) {
  const match = source.match(new RegExp(`(?:pub\\(crate\\)\\s+)?const ${constName}: i64 = ([\\d_]+);`));
  expect(match, `${constName} should exist`).not.toBeNull();
  return Number(match?.[1].replaceAll("_", ""));
}

function extractRustU32Const(source: string, constName: string) {
  const match = source.match(new RegExp(`const ${constName}: u32 = ([\\d_]+);`));
  expect(match, `${constName} should exist`).not.toBeNull();
  return Number(match?.[1].replaceAll("_", ""));
}

type ParseSchema = BaseSchema<unknown, unknown, BaseIssue<unknown>>;

function objectSchemaKeys(schema: unknown) {
  return Object.keys(objectEntries(schema)).toSorted();
}

function expectPaginationArgsSchema(schema: ParseSchema, base: Record<string, unknown>) {
  expect(parse(schema, { ...base, offset: 0, limit: 1 })).toEqual({
    ...base,
    offset: 0,
    limit: 1,
  });
  expect(parse(schema, { ...base, offset: 0, limit: MAX_IPC_PAGINATION_LIMIT })).toEqual({
    ...base,
    offset: 0,
    limit: MAX_IPC_PAGINATION_LIMIT,
  });
  expect(parse(schema, { ...base, offset: MAX_IPC_PAGINATION_OFFSET, limit: 1 })).toEqual({
    ...base,
    offset: MAX_IPC_PAGINATION_OFFSET,
    limit: 1,
  });
  expect(() => parse(schema, { ...base, offset: -1, limit: 1 })).toThrow();
  expect(() => parse(schema, { ...base, offset: MAX_IPC_PAGINATION_OFFSET + 1, limit: 1 })).toThrow();
  expect(() => parse(schema, { ...base, offset: 0.5, limit: 1 })).toThrow();
  expect(() => parse(schema, { ...base, offset: Number.NaN, limit: 1 })).toThrow();
  expect(() => parse(schema, { ...base, offset: 0, limit: 0 })).toThrow();
  expect(() => parse(schema, { ...base, offset: 0, limit: MAX_IPC_PAGINATION_LIMIT + 1 })).toThrow();
  expect(() => parse(schema, { ...base, offset: 0, limit: 1.5 })).toThrow();
  expect(() => parse(schema, { ...base, offset: 0, limit: Number.POSITIVE_INFINITY })).toThrow();
}

function extractImportedApiSchemaNamesFromTauriCommands(source: string) {
  const importMatches = [...source.matchAll(/import\s+\{([^}]*)\}\s+from\s+"@\/api\/schemas";/g)];
  expect(importMatches, "tauri command wrapper should import schemas from the barrel").not.toHaveLength(0);

  return importMatches
    .flatMap((match) => [...(match[1] ?? "").matchAll(/\b([A-Z][A-Za-z0-9]+Schema)\b/g)])
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
    .toSorted();
}

function extractSafeInvokeResponseSchemaNames(source: string) {
  return [...source.matchAll(/\bresponse:\s*(?:[a-zA-Z_$][A-Za-z0-9_$]*\(\s*)?([A-Z][A-Za-z0-9]+Schema)\b/g)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
    .toSorted();
}

function extractSafeInvokeCommandCallCount(source: string) {
  return [...source.matchAll(/\bsafeInvoke\(\s*"/g)].length;
}

function extractSchemaNamesFromSource(source: string) {
  return [...source.matchAll(/\b([A-Z][A-Za-z0-9]+Schema)\b/g)]
    .map((match) => match[1])
    .filter((name): name is string => name !== undefined)
    .toSorted();
}

function readApiSchemaBarrelSource() {
  return readFileSync(join(process.cwd(), "src/api/schemas/index.ts"), "utf8");
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
    expect(parse(AccountDtoSchema, data)).toEqual(data);
  });
  it("parses provider-specific AccountDto capability fixtures without changing display copy", () => {
    const providerFixtures = [
      {
        id: "acc-local",
        kind: "Local",
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
        connection_verification_status: "unverified",
        connection_verified_at: null,
        connection_verification_error: null,
      },
      {
        id: "acc-freshrss",
        kind: "FreshRss",
        name: "FreshRSS",
        display_name: "FreshRSS",
        icon_url: null,
        capabilities: {
          supports_folders: true,
          supports_starring: true,
          supports_search: true,
          supports_delta_sync: true,
          supports_remote_state: true,
        },
        server_url: "https://freshrss.example.com",
        username: "reader",
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: "verified",
        connection_verified_at: "2026-04-15T01:00:00Z",
        connection_verification_error: null,
      },
      {
        id: "acc-freshrss-lowercase",
        kind: "freshrss",
        name: "FreshRSS",
        display_name: "FreshRSS",
        icon_url: null,
        capabilities: {
          supports_folders: true,
          supports_starring: true,
          supports_search: true,
          supports_delta_sync: true,
          supports_remote_state: true,
        },
        server_url: "https://freshrss.example.com",
        username: "reader",
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        connection_verification_status: "verified",
        connection_verified_at: "2026-04-15T01:00:00Z",
        connection_verification_error: null,
      },
    ];

    for (const fixture of providerFixtures) {
      expect(parse(AccountDtoSchema, fixture)).toEqual(fixture);
    }
  });
  it("parses valid AccountSyncStatusDto", () => {
    const data = {
      last_success_at: "2026-04-15T01:00:00Z",
      last_error: null,
      error_count: 0,
      next_retry_at: null,
    };
    expect(parse(AccountSyncStatusSchema, data)).toEqual(data);
  });
  it("keeps account sync status error counts nonnegative integers", () => {
    const data = {
      last_success_at: null,
      last_error: "network",
      error_count: 0,
      next_retry_at: null,
    };

    expect(parse(AccountSyncStatusSchema, { ...data, error_count: 1 })).toEqual({
      ...data,
      error_count: 1,
    });
    expect(() => parse(AccountSyncStatusSchema, { ...data, error_count: -1 })).toThrow();
    expect(() => parse(AccountSyncStatusSchema, { ...data, error_count: 0.5 })).toThrow();
    expect(() =>
      parse(AccountSyncStatusSchema, {
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

    expect(parse(AccountSyncStatusSchema, data)).toEqual(data);
    expect(() =>
      parse(AccountSyncStatusSchema, {
        ...data,
        last_success_at: "2026-04-15",
      }),
    ).toThrow();
    expect(() =>
      parse(AccountSyncStatusSchema, {
        ...data,
        next_retry_at: "2026-04-15T02:00:00",
      }),
    ).toThrow();
    expect(() =>
      parse(AccountSyncStatusSchema, {
        ...data,
        next_retry_at: "not-a-date",
      }),
    ).toThrow();
  });
  it("rejects AccountDto with missing fields", () => {
    expect(() => parse(AccountDtoSchema, { id: "acc-1" })).toThrow();
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

    expect(parse(AccountDtoSchema, data)).toEqual({
      ...data,
      id: "acc-1",
      kind: "local",
      name: "Local",
      display_name: "Local",
    });
    expect(() => parse(AccountDtoSchema, { ...data, id: "" })).toThrow();
    expect(() => parse(AccountDtoSchema, { ...data, kind: "   " })).toThrow();
    expect(() => parse(AccountDtoSchema, { ...data, name: "\t" })).toThrow();
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

    expect(parse(AccountDtoSchema, data)).toEqual({
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

    expect(parse(AccountDtoSchema, { ...data, sync_interval_secs: 60 })).toEqual({
      ...data,
      sync_interval_secs: 60,
    });
    expect(parse(AccountDtoSchema, { ...data, keep_read_items_days: 3650 })).toEqual({
      ...data,
      keep_read_items_days: 3650,
    });
    expect(parse(AccountDtoSchema, { ...data, keep_read_items_days: 0 })).toEqual({
      ...data,
      keep_read_items_days: 0,
    });
    expect(() => parse(AccountDtoSchema, { ...data, sync_interval_secs: 59 })).toThrow();
    expect(() => parse(AccountDtoSchema, { ...data, sync_interval_secs: 86_401 })).toThrow();
    expect(() => parse(AccountDtoSchema, { ...data, sync_interval_secs: 60.5 })).toThrow();
    expect(() =>
      parse(AccountDtoSchema, {
        ...data,
        sync_interval_secs: Number.POSITIVE_INFINITY,
      }),
    ).toThrow();
    expect(() => parse(AccountDtoSchema, { ...data, keep_read_items_days: -1 })).toThrow();
    expect(() => parse(AccountDtoSchema, { ...data, keep_read_items_days: 3651 })).toThrow();
    expect(() => parse(AccountDtoSchema, { ...data, keep_read_items_days: 30.5 })).toThrow();
    expect(() =>
      parse(AccountDtoSchema, {
        ...data,
        keep_read_items_days: Number.POSITIVE_INFINITY,
      }),
    ).toThrow();
  });
  it("rejects AccountDto invalid connection verification timestamps when present", () => {
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
      connection_verification_status: "verified",
      connection_verified_at: "2026-04-15T01:00:00Z",
      connection_verification_error: null,
    };

    expect(parse(AccountDtoSchema, data)).toEqual(data);
    expect(parse(AccountDtoSchema, { ...data, connection_verified_at: null })).toEqual({
      ...data,
      connection_verified_at: null,
    });
    expect(() => parse(AccountDtoSchema, { ...data, connection_verified_at: "2026-04-15" })).toThrow();
    expect(() =>
      parse(AccountDtoSchema, {
        ...data,
        connection_verified_at: "2026-04-15T01:00:00",
      }),
    ).toThrow();
    expect(() => parse(AccountDtoSchema, { ...data, connection_verified_at: "not-a-date" })).toThrow();
  });
  it("accepts quarantined AccountDto status and rejects unknown connection verification statuses", () => {
    const data = {
      id: "acc-1",
      kind: "Quarantined",
      name: "Recovered account",
      display_name: "Recovered account",
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
      sync_on_startup: false,
      sync_on_wake: false,
      keep_read_items_days: 30,
      connection_verification_status: "quarantined",
      connection_verified_at: null,
      connection_verification_error: "Unknown provider kind: DebugProvider",
    };

    expect(parse(AccountDtoSchema, data)).toEqual(data);
    expect(() =>
      parse(AccountDtoSchema, {
        ...data,
        connection_verification_status: "unknown",
      }),
    ).toThrow();
    expect(readRustCommandDtoSource()).toContain(
      'crate::domain::account::ConnectionVerificationStatus::Quarantined => "quarantined"',
    );
  });
  it("keeps AccountDto schema fields aligned with Rust DTO fields", () => {
    expect(objectSchemaKeys(AccountDtoSchema)).toEqual(
      extractRustStructFields(readRustCommandDtoSource(), "AccountDto", "Rust command DTOs"),
    );
    expect(objectSchemaKeys(unwrap(objectEntries(AccountDtoSchema).capabilities))).toEqual(
      extractRustStructFields(readRustCommandDtoSource(), "AccountProviderCapabilitiesDto", "Rust command DTOs"),
    );
  });
  it("keeps AccountSyncStatus schema fields aligned with Rust DTO fields", () => {
    expect(objectSchemaKeys(AccountSyncStatusSchema)).toEqual(
      extractRustStructFields(readRustCommandDtoSource(), "AccountSyncStatus", "Rust command DTOs"),
    );
  });
  it("parses valid FolderDto", () => {
    const data = {
      id: "f-1",
      account_id: "acc-1",
      name: "Tech",
      sort_order: 0,
    };
    expect(parse(FolderDtoSchema, data)).toEqual(data);
  });
  it("rejects blank FolderDto identity and display fields", () => {
    const data = {
      id: "f-1",
      account_id: "acc-1",
      name: "Tech",
      sort_order: 0,
    };

    expect(() => parse(FolderDtoSchema, { ...data, id: "" })).toThrow();
    expect(() => parse(FolderDtoSchema, { ...data, id: "   " })).toThrow();
    expect(() => parse(FolderDtoSchema, { ...data, account_id: "" })).toThrow();
    expect(() => parse(FolderDtoSchema, { ...data, account_id: "   " })).toThrow();
    expect(() => parse(FolderDtoSchema, { ...data, name: "" })).toThrow();
    expect(() => parse(FolderDtoSchema, { ...data, name: "   " })).toThrow();
  });
  it("keeps FolderDto sort_order as a nonnegative integer order value", () => {
    const data = {
      id: "f-1",
      account_id: "acc-1",
      name: "Tech",
      sort_order: 0,
    };

    expect(parse(FolderDtoSchema, { ...data, sort_order: 1 })).toEqual({
      ...data,
      sort_order: 1,
    });
    expect(() => parse(FolderDtoSchema, { ...data, sort_order: -1 })).toThrow();
    expect(() => parse(FolderDtoSchema, { ...data, sort_order: 0.5 })).toThrow();
    expect(() => parse(FolderDtoSchema, { ...data, sort_order: Number.POSITIVE_INFINITY })).toThrow();
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
    expect(parse(FeedDtoSchema, data)).toEqual(data);
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

    expect(() => parse(FeedDtoSchema, { ...data, id: "" })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, id: "   " })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, account_id: "" })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, account_id: "   " })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, title: "" })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, title: "   " })).toThrow();
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

    expect(() => parse(FeedDtoSchema, { ...data, url: "" })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, url: "   " })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, url: " https://example.com/feed.xml " })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, url: "https://" })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, url: "ftp://example.com/feed.xml" })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, url: "mailto:feed@example.com" })).toThrow();
    expect(() =>
      parse(FeedDtoSchema, {
        ...data,
        url: "https://example.com/feed.xml\nnext",
      }),
    ).toThrow();
    expect(parse(FeedDtoSchema, { ...data, site_url: "" })).toEqual({
      ...data,
      site_url: "",
    });
    expect(() => parse(FeedDtoSchema, { ...data, site_url: "   " })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, site_url: " https://example.com " })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, site_url: "ftp://example.com" })).toThrow();
  });
  it("keeps FeedDto schema fields aligned with Rust DTO fields", () => {
    expect(objectSchemaKeys(FeedDtoSchema)).toEqual(
      extractRustStructFields(readRustCommandDtoSource(), "FeedDto", "Rust command DTOs"),
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

    expect(() => parse(FeedDtoSchema, { ...data, unread_count: -1 })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, unread_count: 1.5 })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, unread_count: Number.POSITIVE_INFINITY })).toThrow();
    expect(() => parse(FeedDtoSchema, { ...data, unread_count: "1" })).toThrow();
  });
  it("parses valid FeedArticleSummaryDto", () => {
    const data = {
      feed_id: "feed-1",
      latest_article_at: "2026-04-01T10:00:00Z",
      starred_count: 2,
      recent_article_count: 12,
    };
    expect(parse(FeedArticleSummaryDtoSchema, data)).toEqual(data);
    expect(parse(FeedArticleSummaryDtoSchema, { ...data, latest_article_at: null })).toEqual({
      ...data,
      latest_article_at: null,
    });
  });
  it("rejects invalid feed summary starred counts", () => {
    const data = {
      feed_id: "feed-1",
      latest_article_at: "2026-04-01T10:00:00Z",
      starred_count: 0,
      recent_article_count: 0,
    };

    expect(() => parse(FeedArticleSummaryDtoSchema, { ...data, starred_count: -1 })).toThrow();
    expect(() => parse(FeedArticleSummaryDtoSchema, { ...data, starred_count: 1.5 })).toThrow();
    expect(() =>
      parse(FeedArticleSummaryDtoSchema, {
        ...data,
        starred_count: Number.POSITIVE_INFINITY,
      }),
    ).toThrow();
    expect(() =>
      parse(FeedArticleSummaryDtoSchema, {
        ...data,
        latest_article_at: "2026-04-01",
      }),
    ).toThrow();
    expect(() =>
      parse(FeedArticleSummaryDtoSchema, {
        ...data,
        latest_article_at: "2026-04-01T10:00:00",
      }),
    ).toThrow();
    expect(() =>
      parse(FeedArticleSummaryDtoSchema, {
        ...data,
        latest_article_at: "not-a-date",
      }),
    ).toThrow();
  });
  it("requires a nonnegative integer recent_article_count", () => {
    const data = {
      feed_id: "feed-1",
      latest_article_at: "2026-04-01T10:00:00Z",
      starred_count: 0,
      recent_article_count: 0,
    };

    // strictObject: the field is required, so the backend must always send it.
    const { recent_article_count: _omitted, ...withoutRecentCount } = data;
    expect(() => parse(FeedArticleSummaryDtoSchema, withoutRecentCount)).toThrow();
    expect(() => parse(FeedArticleSummaryDtoSchema, { ...data, recent_article_count: -1 })).toThrow();
    expect(() => parse(FeedArticleSummaryDtoSchema, { ...data, recent_article_count: 1.5 })).toThrow();
    expect(() =>
      parse(FeedArticleSummaryDtoSchema, { ...data, recent_article_count: Number.POSITIVE_INFINITY }),
    ).toThrow();
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
    expect(parse(ArticleDtoSchema, data)).toEqual(data);
  });
  it("rejects ArticleDto invalid published timestamps", () => {
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

    expect(() => parse(ArticleDtoSchema, { ...data, published_at: "" })).toThrow();
    expect(() => parse(ArticleDtoSchema, { ...data, published_at: "2026-03-25" })).toThrow();
    expect(() => parse(ArticleDtoSchema, { ...data, published_at: "2026-03-25T10:00:00" })).toThrow();
    expect(() => parse(ArticleDtoSchema, { ...data, published_at: "not-a-date" })).toThrow();
    expect(() => parse(ArticleDtoSchema, { ...data, viewed_at: "2026-03-25" })).toThrow();
    expect(() => parse(ArticleDtoSchema, { ...data, viewed_at: "not-a-date" })).toThrow();
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

    expect(parse(ArticleDtoSchema, data)).toMatchObject({
      url: "https://example.com/article",
      thumbnail: "https://example.com/thumb.png",
    });
    expect(() => parse(ArticleDtoSchema, { ...data, url: "   " })).toThrow();
    expect(() => parse(ArticleDtoSchema, { ...data, thumbnail: "   " })).toThrow();
  });
  it("rejects ArticleDto thumbnails outside the reader image privacy contract", () => {
    const data = {
      id: "art-1",
      feed_id: "feed-1",
      title: "Hello",
      content_sanitized: "<p>Hi</p>",
      summary: null,
      url: "https://example.com/article",
      author: null,
      published_at: "2026-03-25T10:00:00Z",
      thumbnail: "https://example.com/thumb.png",
      is_read: false,
      is_starred: false,
    };

    expect(() =>
      parse(ArticleDtoSchema, {
        ...data,
        thumbnail: "http://example.com/thumb.png",
      }),
    ).toThrow();
    expect(() =>
      parse(ArticleDtoSchema, {
        ...data,
        thumbnail: "data:image/svg+xml,<svg></svg>",
      }),
    ).toThrow();
    expect(() =>
      parse(ArticleDtoSchema, {
        ...data,
        thumbnail: "https://user:pass@example.com/thumb.png",
      }),
    ).toThrow();
  });
  it("parses valid TagDto", () => {
    expect(
      parse(TagDtoSchema, {
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
    expect(parse(TagDtoSchema, { id: "tag-1", name: "Important", color: null })).toEqual({
      id: "tag-1",
      name: "Important",
      color: null,
    });
  });
  it("rejects invalid TagDto display fields", () => {
    expect(() => parse(TagDtoSchema, { id: "tag-1", name: "   ", color: null })).toThrow();
    expect(() => parse(TagDtoSchema, { id: "tag-1", name: "Important", color: "red" })).toThrow();
    expect(() => parse(TagDtoSchema, { id: "tag-1", name: "Important", color: "#fff" })).toThrow();
  });
  it("rejects invalid tag article counts", () => {
    expect(() => parse(TagArticleCountsSchema, { "tag-1": -1 })).toThrow();
    expect(() => parse(TagArticleCountsSchema, { "tag-1": 1.5 })).toThrow();
  });
  it("rejects arrays at the tag article counts record boundary", () => {
    const emptyArray: unknown = [];
    const numberArray: unknown = [1];

    expect(is(TagArticleCountsSchema, emptyArray)).toBe(false);
    expect(is(TagArticleCountsSchema, numberArray)).toBe(false);
    expect(parse(TagArticleCountsSchema, { "tag-1": 1 })).toEqual({ "tag-1": 1 });
  });
  it("parses valid MuteKeywordDto", () => {
    const data = {
      id: "mute-1",
      keyword: "Kindle Unlimited",
      scope: "title_and_body",
      created_at: "2026-04-15T01:00:00Z",
      updated_at: "2026-04-15T01:00:00Z",
    };
    expect(parse(MuteKeywordDtoSchema, { ...data, keyword: " Kindle Unlimited " })).toEqual(data);
  });
  it("rejects blank mute keyword DTO response keywords", () => {
    const data = {
      id: "mute-1",
      keyword: "Kindle Unlimited",
      scope: "title_and_body",
      created_at: "2026-04-15T01:00:00Z",
      updated_at: "2026-04-15T01:00:00Z",
    };

    expect(() => parse(MuteKeywordDtoSchema, { ...data, keyword: "" })).toThrow();
    expect(() => parse(MuteKeywordDtoSchema, { ...data, keyword: "   " })).toThrow();
  });
  it("rejects mute keyword DTO response timestamps without ISO datetime offsets", () => {
    const data = {
      id: "mute-1",
      keyword: "Kindle Unlimited",
      scope: "title_and_body",
      created_at: "2026-04-15T01:00:00Z",
      updated_at: "2026-04-15T01:00:00Z",
    };

    expect(() => parse(MuteKeywordDtoSchema, { ...data, created_at: "2026-04-15" })).toThrow();
    expect(() =>
      parse(MuteKeywordDtoSchema, {
        ...data,
        created_at: "2026-04-15T01:00:00",
      }),
    ).toThrow();
    expect(() => parse(MuteKeywordDtoSchema, { ...data, updated_at: "not-a-date" })).toThrow();
  });
  it("parses valid DiscoveredFeedDto", () => {
    expect(
      parse(DiscoveredFeedDtoSchema, {
        url: " https://example.com/feed.xml ",
        title: "",
      }),
    ).toEqual({
      url: "https://example.com/feed.xml",
      title: "",
    });
    expect(
      parse(DiscoveredFeedDtoSchema, {
        url: "http://example.com/feed.xml",
        title: "Blog",
      }),
    ).toEqual({
      url: "http://example.com/feed.xml",
      title: "Blog",
    });
    expect(() => parse(DiscoveredFeedDtoSchema, { url: "   ", title: "Blog" })).toThrow();
    expect(() => parse(DiscoveredFeedDtoSchema, { url: "https://", title: "Blog" })).toThrow();
    expect(() =>
      parse(DiscoveredFeedDtoSchema, {
        url: "mailto:hello@example.com",
        title: "Blog",
      }),
    ).toThrow();
    expect(() =>
      parse(DiscoveredFeedDtoSchema, {
        url: "https://example.com/feed.xml\nnext",
        title: "Blog",
      }),
    ).toThrow();
  });
  it("parses valid UpdateInfoDto", () => {
    expect(
      parse(UpdateInfoDtoSchema, {
        version: " 1.0.0+build.7 ",
        body: "Release notes",
        channel: "stable",
        prerelease: false,
        source: " github-latest-json ",
      }),
    ).toEqual({
      version: "1.0.0+build.7",
      body: "Release notes",
      channel: "stable",
      prerelease: false,
      source: "github-latest-json",
    });
  });
  it("keeps UpdateInfoDto body null or empty for updater UI compatibility", () => {
    expect(
      parse(UpdateInfoDtoSchema, {
        version: "1.0.0",
        body: null,
        channel: "stable",
        prerelease: false,
        source: "github-latest-json",
      }),
    ).toEqual({
      version: "1.0.0",
      body: null,
      channel: "stable",
      prerelease: false,
      source: "github-latest-json",
    });
    expect(
      parse(UpdateInfoDtoSchema, {
        version: "1.0.0",
        body: "",
        channel: "stable",
        prerelease: false,
        source: "github-latest-json",
      }),
    ).toEqual({
      version: "1.0.0",
      body: "",
      channel: "stable",
      prerelease: false,
      source: "github-latest-json",
    });
  });
  it("rejects UpdateInfoDto with blank version", () => {
    const stableUpdate = {
      body: null,
      channel: "stable",
      prerelease: false,
      source: "github-latest-json",
    };
    expect(() => parse(UpdateInfoDtoSchema, { ...stableUpdate, version: "" })).toThrow();
    expect(() => parse(UpdateInfoDtoSchema, { ...stableUpdate, version: "   " })).toThrow();
  });
  it("rejects malformed UpdateInfoDto semantic versions", () => {
    const stableUpdate = {
      body: null,
      channel: "stable",
      prerelease: false,
      source: "github-latest-json",
    };
    for (const version of ["v1.2.3", "1.2", "1.2.3.4", "01.2.3", "1.02.3", "1.2.03", "1.2.3+", "1.2.3-"]) {
      expect(() => parse(UpdateInfoDtoSchema, { ...stableUpdate, version })).toThrow();
    }
  });
  it("rejects UpdateInfoDto with blank source", () => {
    const stableUpdate = {
      version: "1.0.0",
      body: null,
      channel: "stable",
      prerelease: false,
    };
    expect(() => parse(UpdateInfoDtoSchema, { ...stableUpdate, source: "" })).toThrow();
    expect(() => parse(UpdateInfoDtoSchema, { ...stableUpdate, source: "   " })).toThrow();
  });
  it("rejects non-stable or prerelease UpdateInfoDto manifests", () => {
    const stableUpdate = {
      version: "1.0.0",
      body: null,
      source: "github-latest-json",
    };
    expect(() =>
      parse(UpdateInfoDtoSchema, {
        ...stableUpdate,
        channel: "beta",
        prerelease: false,
      }),
    ).toThrow();
    expect(() =>
      parse(UpdateInfoDtoSchema, {
        ...stableUpdate,
        channel: "stable",
        prerelease: true,
      }),
    ).toThrow();
  });
  it("accepts finite updater progress event payloads and rejects malformed values", () => {
    expect(
      parse(UpdateDownloadProgressEventPayloadSchema, {
        session_id: 1,
        percent: 42,
        loaded: 100,
      }),
    ).toEqual({
      session_id: 1,
      percent: 42,
      loaded: 100,
    });
    expect(
      parse(UpdateDownloadProgressEventPayloadSchema, {
        session_id: 1,
        percent: null,
      }),
    ).toEqual({
      session_id: 1,
      percent: null,
    });
    expect(
      safeParse(UpdateDownloadProgressEventPayloadSchema, {
        session_id: 1,
        percent: "42",
      }).success,
    ).toBe(false);
    expect(
      safeParse(UpdateDownloadProgressEventPayloadSchema, {
        session_id: 1,
        percent: Number.NaN,
      }).success,
    ).toBe(false);
    expect(
      safeParse(UpdateDownloadProgressEventPayloadSchema, {
        session_id: 1,
        percent: Number.POSITIVE_INFINITY,
      }).success,
    ).toBe(false);
    expect(
      safeParse(UpdateDownloadProgressEventPayloadSchema, {
        session_id: 0,
        percent: 42,
      }).success,
    ).toBe(false);
    expect(safeParse(UpdateDownloadProgressEventPayloadSchema, { loaded: 100 }).success).toBe(false);
    expect(parse(UpdateReadyEventPayloadSchema, { session_id: 1 })).toEqual({
      session_id: 1,
    });
    expect(safeParse(UpdateReadyEventPayloadSchema, { session_id: 0 }).success).toBe(false);
  });
  it("rejects unknown backend DTO fields while preserving updater progress event passthrough fields", () => {
    expect(
      safeParse(ArticleDtoSchema, {
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
        backend_added_field: "unexpected",
      }).success,
    ).toBe(false);
    expect(
      safeParse(AccountDtoSchema, {
        id: "acc-1",
        kind: "local",
        name: "Local",
        server_url: null,
        username: null,
        sync_interval_secs: 3600,
        sync_on_startup: true,
        sync_on_wake: false,
        keep_read_items_days: 30,
        capabilities: {
          supports_folders: false,
          supports_starring: false,
          supports_search: false,
          supports_delta_sync: false,
          supports_remote_state: false,
          backend_added_field: true,
        },
      }).success,
    ).toBe(false);
    expect(
      safeParse(FeedDtoSchema, {
        id: "feed-1",
        account_id: "acc-1",
        folder_id: null,
        remote_id: null,
        title: "Blog",
        url: "https://example.com/feed.xml",
        site_url: "",
        unread_count: 0,
        reader_mode: "on",
        web_preview_mode: "off",
        backend_added_field: "unexpected",
      }).success,
    ).toBe(false);
    expect(
      parse(UpdateDownloadProgressEventPayloadSchema, {
        session_id: 1,
        percent: 1,
        loaded: 100,
      }),
    ).toEqual({
      session_id: 1,
      percent: 1,
      loaded: 100,
    });
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
    expect(parse(PlatformInfoSchema, data)).toEqual(data);
  });
  it("keeps dev runtime window dimensions aligned with Rust command max", () => {
    const rustMaxDimension = extractRustU32Const(readRustPlatformCommandSource(), "MAX_DEV_WINDOW_DIMENSION_PX");

    expect(rustMaxDimension).toBe(MAX_DEV_WINDOW_DIMENSION_PX);
    expect(
      parse(DevRuntimeOptionsSchema, {
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
      parse(DevRuntimeOptionsSchema, {
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
      parse(AppErrorSchema, {
        type: "UserVisible",
        message: "Something went wrong",
      }),
    ).toEqual({
      type: "UserVisible",
      message: "Something went wrong",
    });
  });
  it("parses Retryable error", () => {
    expect(parse(AppErrorSchema, { type: "Retryable", message: "Network timeout" })).toEqual({
      type: "Retryable",
      message: "Network timeout",
    });
  });
  it("rejects unknown error type", () => {
    expect(() => parse(AppErrorSchema, { type: "Unknown", message: "?" })).toThrow();
  });
  it("rejects empty AppError messages", () => {
    expect(() => parse(AppErrorSchema, { type: "UserVisible", message: "" })).toThrow();
    expect(() => parse(AppErrorSchema, { type: "UserVisible", message: "   " })).toThrow();
    expect(() => parse(AppErrorSchema, { type: "Retryable", message: "" })).toThrow();
    expect(() => parse(AppErrorSchema, { type: "Retryable", message: "   " })).toThrow();
  });
  it("keeps AppError message length and control character policy synced with Rust DTOs", () => {
    expect(extractRustUsizeConst(readRustCommandDtoSource(), "APP_ERROR_MESSAGE_MAX_CHARS")).toBe(
      APP_ERROR_MESSAGE_MAX_CHARS,
    );
    expect(parse(AppErrorSchema, { type: "UserVisible", message: "x".repeat(APP_ERROR_MESSAGE_MAX_CHARS) })).toEqual({
      type: "UserVisible",
      message: "x".repeat(APP_ERROR_MESSAGE_MAX_CHARS),
    });

    expect(() =>
      parse(AppErrorSchema, { type: "UserVisible", message: "x".repeat(APP_ERROR_MESSAGE_MAX_CHARS + 1) }),
    ).toThrow();
    expect(() => parse(AppErrorSchema, { type: "UserVisible", message: "line 1\nline 2" })).toThrow();
    expect(() => parse(AppErrorSchema, { type: "UserVisible", message: "bad\u0000message" })).toThrow();
    expect(parse(AppErrorSchema, { type: "UserVisible", message: "https://example.com/token/abc123" })).toEqual({
      type: "UserVisible",
      message: "https://example.com/token/abc123",
    });
  });

  it("keeps support codes and diagnostics ids out of the AppError wire contract", () => {
    expect(() =>
      parse(AppErrorSchema, {
        type: "UserVisible",
        message: "Something went wrong",
        supportCode: "URR-0001",
      }),
    ).toThrow();
    expect(() =>
      parse(AppErrorSchema, {
        type: "Diagnostics",
        message: "Response validation failed. See diagnostics for details.",
        diagnosticsId: "diag-1",
      }),
    ).toThrow();
  });
});

describe("primitive command result schemas", () => {
  it("keeps primitive Tauri command result parsing strict", () => {
    expect(parse(NullResponseSchema, null)).toBeNull();
    expect(parse(IntResponseSchema, 0)).toBe(0);
    expect(parse(NonnegativeIntResponseSchema, 0)).toBe(0);
    expect(parse(CountResponseSchema, 1)).toBe(1);
    expect(parse(StringResponseSchema, "ok")).toBe("ok");
    expect(parse(BooleanResponseSchema, false)).toBe(false);

    expect(() => parse(NullResponseSchema, undefined)).toThrow();
    expect(() => parse(IntResponseSchema, 1.5)).toThrow();
    expect(() => parse(IntResponseSchema, Number.NaN)).toThrow();
    expect(() => parse(NonnegativeIntResponseSchema, -1)).toThrow();
    expect(() => parse(NonnegativeIntResponseSchema, Number.NaN)).toThrow();
    expect(() => parse(CountResponseSchema, -1)).toThrow();
    expect(() => parse(CountResponseSchema, 1.5)).toThrow();
    expect(() => parse(CountResponseSchema, Number.MAX_SAFE_INTEGER + 1)).toThrow();
    expect(() => parse(StringResponseSchema, 1)).toThrow();
    expect(() => parse(BooleanResponseSchema, "false")).toThrow();
  });

  it("keeps count response safe integer cap synced with Rust DTOs", () => {
    expect(parse(CountResponseSchema, 0)).toBe(0);
    expect(parse(CountResponseSchema, COUNT_RESPONSE_MAX_VALUE)).toBe(COUNT_RESPONSE_MAX_VALUE);
    expect(parse(NonnegativeIntResponseSchema, 0)).toBe(0);
    expect(CountResponseSchema).not.toBe(NonnegativeIntResponseSchema);
    expect(COUNT_RESPONSE_MAX_VALUE).toBe(Number.MAX_SAFE_INTEGER);
    expect(extractRustI64Const(readRustCommandDtoSource(), "COUNT_RESPONSE_MAX_VALUE")).toBe(COUNT_RESPONSE_MAX_VALUE);
    expect(() => parse(CountResponseSchema, COUNT_RESPONSE_MAX_VALUE + 1)).toThrow();
  });
  it("normalizes nullable starred counts and rejects invalid count values", () => {
    expect(parse(NullableStarredCountSchema, null)).toBe(0);
    expect(parse(NullableStarredCountSchema, 0)).toBe(0);
    expect(parse(NullableStarredCountSchema, 2)).toBe(2);

    expect(() => parse(NullableStarredCountSchema, -1)).toThrow();
    expect(() => parse(NullableStarredCountSchema, 1.5)).toThrow();
    expect(() => parse(NullableStarredCountSchema, Number.NaN)).toThrow();
    expect(() => parse(NullableStarredCountSchema, Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("frontend schema runtime contracts", () => {
  it("keeps schema parse fallback action state disabled for UI actions", () => {
    expect(SCHEMA_PARSE_FAILURE_ACTION_STATE).toEqual({
      enabled: false,
      reason: "schema-parse-failure",
    });
    expect(isAppAction(SCHEMA_PARSE_FAILURE_ACTION_STATE.reason)).toBe(false);
    expect(APP_ACTIONS).not.toContain(SCHEMA_PARSE_FAILURE_ACTION_STATE.reason);
  });

  it("versions schema-owned query cache roots so app upgrades do not reuse stale cache", () => {
    expect(FRONTEND_SCHEMA_CONTRACT_VERSION).toBe(1);
    expect(QUERY_CACHE_KEY_VERSION).toBe(`schema-v${FRONTEND_SCHEMA_CONTRACT_VERSION}`);
    expect(createSchemaVersionedQueryKey("feeds")).toEqual([QUERY_CACHE_KEY_VERSION, "feeds"]);
  });
});

describe("PreferencesDtoSchema", () => {
  it("accepts known, shortcut, and unknown string preference keys while rejecting invalid records", () => {
    expect(
      parse(PreferencesDtoSchema, {
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

    expect(() => parse(PreferencesDtoSchema, { "": "blank" })).toThrow();
    expect(() => parse(PreferencesDtoSchema, { "   ": "blank" })).toThrow();
    expect(() => parse(PreferencesDtoSchema, { theme: null })).toThrow();
    expect(() => parse(PreferencesDtoSchema, { theme: true })).toThrow();
  });

  it("keeps API preference result parsing strict for known keys without normalizing values", () => {
    expect(
      parse(PreferencesDtoSchema, {
        theme: "dark",
        shortcut_next_article: " Shift+J ",
        selected_account_id: "acc-1",
      }),
    ).toEqual({
      theme: "dark",
      shortcut_next_article: " Shift+J ",
      selected_account_id: "acc-1",
    });

    expect(() => parse(PreferencesDtoSchema, { theme: "midnight" })).toThrow();
    expect(() => parse(PreferencesDtoSchema, { shortcut_next_article: "   " })).toThrow();
    expect(() => parse(PreferencesDtoSchema, { selected_account_id: "" })).toThrow();
    expect(() => parse(PreferencesDtoSchema, { theme: 1 })).toThrow();
    expect(() => parse(PreferencesDtoSchema, [])).toThrow();
    expect(() => parse(PreferencesDtoSchema, null)).toThrow();
  });

  it("keeps unknown preference passthrough bounded by size, prefix, and retirement policy", () => {
    expect(
      parse(PreferencesDtoSchema, {
        custom_backend_preference: "a".repeat(1024),
      }),
    ).toEqual({
      custom_backend_preference: "a".repeat(1024),
    });

    expect(() => parse(PreferencesDtoSchema, { [`${"a".repeat(129)}`]: "too-long-key" })).toThrow();
    expect(() =>
      parse(PreferencesDtoSchema, {
        custom_backend_preference: "a".repeat(1025),
      }),
    ).toThrow();
    expect(() => parse(PreferencesDtoSchema, { shortcut_unknown_action: "x" })).toThrow();
  });
});

describe("SettingsProfileSchema", () => {
  it("accepts v1 settings profiles and import result counts", () => {
    expect(
      parse(SettingsProfileSchema, {
        version: 1,
        exported_at: "2026-06-08T00:00:00Z",
        content_type: "application/vnd.ultra-rss-reader.settings-profile+json",
        preferences: {
          theme: "dark",
          selected_account_id: "source-account",
        },
        accounts: [
          {
            source_id: "source-account",
            kind: "FreshRss",
            name: "Fresh",
            server_url: "https://rss.example.com",
            username: "alice",
            sync_interval_secs: 3600,
            sync_on_startup: true,
            sync_on_wake: false,
            keep_read_items_days: 30,
          },
        ],
        tags: [{ name: "Tech", color: "#00FF00" }],
        mute_keywords: [{ keyword: "spoiler", scope: "title" }],
      }),
    ).toMatchObject({
      version: 1,
      tags: [{ name: "Tech", color: "#00ff00" }],
    });

    expect(
      parse(SettingsProfileImportResultSchema, {
        accounts_created: 1,
        accounts_updated: 2,
        preferences_imported: 3,
        preferences_skipped: 4,
        tags_created: 5,
        tags_updated: 6,
        mute_keywords_created: 7,
        mute_keywords_skipped: 8,
      }),
    ).toEqual({
      accounts_created: 1,
      accounts_updated: 2,
      preferences_imported: 3,
      preferences_skipped: 4,
      tags_created: 5,
      tags_updated: 6,
      mute_keywords_created: 7,
      mute_keywords_skipped: 8,
    });
  });

  it("rejects malformed settings profile shapes", () => {
    const validProfile = {
      version: 1,
      exported_at: "2026-06-08T00:00:00Z",
      content_type: "application/vnd.ultra-rss-reader.settings-profile+json",
      preferences: {},
      accounts: [],
      tags: [],
      mute_keywords: [],
    };

    expect(() => parse(SettingsProfileSchema, { ...validProfile, version: 2 })).toThrow();
    expect(() => parse(SettingsProfileSchema, { ...validProfile, preferences: { theme: "invalid" } })).toThrow();
    expect(() => parse(SettingsProfileSchema, { ...validProfile, accounts: [{ kind: "FreshRss" }] })).toThrow();
    expect(() => parse(SettingsProfileSchema, { ...validProfile, tags: [{ name: "Tech", color: "green" }] })).toThrow();
    expect(() =>
      parse(SettingsProfileImportResultSchema, {
        accounts_created: -1,
        accounts_updated: 0,
        preferences_imported: 0,
        preferences_skipped: 0,
        tags_created: 0,
        tags_updated: 0,
        mute_keywords_created: 0,
        mute_keywords_skipped: 0,
      }),
    ).toThrow();
  });
});

describe("BrowserWebviewStateSchema", () => {
  it("accepts an empty string URL as the backend state value", () => {
    expect(
      parse(BrowserWebviewStateSchema, {
        url: "",
        can_go_back: false,
        can_go_forward: false,
        is_loading: false,
        load_generation: 0,
      }),
    ).toEqual({
      url: "",
      can_go_back: false,
      can_go_forward: false,
      is_loading: false,
      load_generation: 0,
    });
  });

  it("accepts a relative URL as the backend state value", () => {
    expect(
      parse(BrowserWebviewStateSchema, {
        url: "/reader/article",
        can_go_back: false,
        can_go_forward: true,
        is_loading: true,
        load_generation: 1,
      }),
    ).toEqual({
      url: "/reader/article",
      can_go_back: false,
      can_go_forward: true,
      is_loading: true,
      load_generation: 1,
    });
  });

  it("accepts an HTTP URL as the backend state value", () => {
    expect(
      parse(BrowserWebviewStateSchema, {
        url: "http://example.com/article",
        can_go_back: true,
        can_go_forward: false,
        is_loading: false,
        load_generation: 2,
      }),
    ).toEqual({
      url: "http://example.com/article",
      can_go_back: true,
      can_go_forward: false,
      is_loading: false,
      load_generation: 2,
    });
  });
});

describe("BrowserWebviewFallbackPayloadSchema", () => {
  it("accepts the native fallback event payload shape", () => {
    expect(
      parse(BrowserWebviewFallbackPayloadSchema, {
        url: "https://example.com/fallback",
        opened_external: false,
        error_message: null,
      }),
    ).toEqual({
      url: "https://example.com/fallback",
      opened_external: false,
      error_message: null,
    });
  });

  it("rejects unknown and malformed native fallback event fields", () => {
    expect(() =>
      parse(BrowserWebviewFallbackPayloadSchema, {
        url: "https://example.com/fallback",
        opened_external: false,
        error_message: null,
        extra: true,
      }),
    ).toThrow();
    expect(() =>
      parse(BrowserWebviewFallbackPayloadSchema, {
        url: "https://example.com/fallback",
        opened_external: "false",
        error_message: null,
      }),
    ).toThrow();
  });
});

describe("BrowserWebviewDiagnosticsPayloadSchema", () => {
  it("accepts the native diagnostics event payload shape", () => {
    expect(
      parse(BrowserWebviewDiagnosticsPayloadSchema, {
        action: "resize",
        requestedLogical: { x: 1, y: 2, width: 300, height: 200 },
        appliedLogical: { x: 1, y: 2, width: 300, height: 200 },
        scaleFactor: 2,
        nativeWebviewBounds: null,
      }),
    ).toEqual({
      action: "resize",
      requestedLogical: { x: 1, y: 2, width: 300, height: 200 },
      appliedLogical: { x: 1, y: 2, width: 300, height: 200 },
      scaleFactor: 2,
      nativeWebviewBounds: null,
    });
  });

  it("rejects unknown and malformed native diagnostics event fields", () => {
    expect(() =>
      parse(BrowserWebviewDiagnosticsPayloadSchema, {
        action: "resize",
        requestedLogical: { x: 1, y: 2, width: 300, height: 200, right: 301 },
        appliedLogical: { x: 1, y: 2, width: 300, height: 200 },
        scaleFactor: 2,
        nativeWebviewBounds: null,
      }),
    ).toThrow();
    expect(() =>
      parse(BrowserWebviewDiagnosticsPayloadSchema, {
        action: "resize",
        requestedLogical: { x: 1, y: 2, width: 300, height: 200 },
        appliedLogical: { x: 1, y: 2, width: 300, height: 200 },
        scaleFactor: Number.NaN,
        nativeWebviewBounds: null,
      }),
    ).toThrow();
  });

  it("rejects native diagnostics coordinates outside the support-safe cap", () => {
    expect(() =>
      parse(BrowserWebviewDiagnosticsPayloadSchema, {
        action: "resize",
        requestedLogical: { x: -10001, y: 2, width: 300, height: 200 },
        appliedLogical: { x: 1, y: 2, width: 300, height: 200 },
        scaleFactor: 2,
        nativeWebviewBounds: null,
      }),
    ).toThrow();
    expect(() =>
      parse(BrowserWebviewDiagnosticsPayloadSchema, {
        action: "resize",
        requestedLogical: { x: 1, y: 2, width: 300, height: 200 },
        appliedLogical: { x: 1, y: 2, width: 300, height: 200 },
        scaleFactor: 2,
        nativeWebviewBounds: { x: 1, y: 2, width: 10001, height: 200 },
      }),
    ).toThrow();
  });
});

describe("command args schemas", () => {
  it("parses listArticlesArgs", () => {
    expect(parse(listArticlesArgs, { feedId: "f-1" })).toEqual({
      feedId: "f-1",
    });
  });
  it("parses listArticlesArgs with optional fields", () => {
    expect(parse(listArticlesArgs, { feedId: "f-1", offset: 0, limit: 20 })).toEqual({
      feedId: "f-1",
      offset: 0,
      limit: 20,
    });
  });
  it("accepts listArticlesArgs with a single article state filter", () => {
    expect(parse(listArticlesArgs, { feedId: "f-1", unreadOnly: true })).toEqual({
      feedId: "f-1",
      unreadOnly: true,
    });
    expect(parse(listArticlesArgs, { feedId: "f-1", starredOnly: true })).toEqual({
      feedId: "f-1",
      starredOnly: true,
    });
  });
  it("rejects listArticlesArgs with missing feedId", () => {
    expect(() => parse(listArticlesArgs, {})).toThrow();
  });
  it("rejects listArticlesArgs with mutually exclusive filters", () => {
    expect(() =>
      parse(listArticlesArgs, {
        feedId: "f-1",
        unreadOnly: true,
        starredOnly: true,
      }),
    ).toThrow("Article list filters are mutually exclusive");
  });
  it("parses markArticleReadArgs with optional read", () => {
    expect(parse(markArticleReadArgs, { articleId: "a-1" })).toEqual({
      articleId: "a-1",
    });
  });
  it("rejects empty bulk markArticlesReadArgs article id lists", () => {
    expect(parse(markArticlesReadArgs, { articleIds: ["a-1"] })).toEqual({
      articleIds: ["a-1"],
    });
    expect(() => parse(markArticlesReadArgs, { articleIds: [] })).toThrow();
  });
  it("parses listStarredArticlesArgs", () => {
    expect(
      parse(listStarredArticlesArgs, {
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
      parse(listRecentArticlesArgs, {
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
    expect(parse(countAccountStarredArticlesArgs, { accountId: "acc-1" })).toEqual({ accountId: "acc-1" });
  });
  it("parses oldUnreadArticlesArgs and rejects arbitrary periods", () => {
    expect(
      parse(oldUnreadArticlesArgs, {
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
      parse(oldUnreadArticlesArgs, {
        scopeKind: "feed",
        targetId: "feed-1",
        olderThanDays: 14,
      }),
    ).toThrow();
  });
  it("rejects oldUnreadArticlesArgs periods above the supported 90 day preset", () => {
    expect(
      parse(oldUnreadArticlesArgs, {
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
      parse(oldUnreadArticlesArgs, {
        scopeKind: "feed",
        targetId: "feed-1",
        olderThanDays: 91,
      }),
    ).toThrow();
  });
  it("parses toggleArticleStarArgs", () => {
    expect(parse(toggleArticleStarArgs, { articleId: "a-1", starred: true })).toEqual({
      articleId: "a-1",
      starred: true,
    });
  });
  it("parses addAccountArgs", () => {
    expect(parse(addAccountArgs, { kind: "Local", name: "Test" })).toEqual({
      kind: "Local",
      name: "Test",
    });
  });
  it("keeps addAccount provider args discriminated by provider kind", () => {
    expect(parse(addAccountArgs, { kind: "Local", name: "Test" })).toEqual({
      kind: "Local",
      name: "Test",
    });
    expect(
      parse(addAccountArgs, {
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
    expect(() => parse(addAccountArgs, { kind: "FreshRss", name: "FreshRSS" })).toThrow();
    expect(() =>
      parse(addAccountArgs, {
        kind: "FreshRss",
        name: "FreshRSS",
        serverUrl: "",
        username: "alice",
        password: "pw",
      }),
    ).toThrow();
    expect(() =>
      parse(addAccountArgs, {
        kind: "FreshRss",
        name: "FreshRSS",
        serverUrl: "https://rss.example.com",
        username: "   ",
        password: "pw",
      }),
    ).toThrow();
    expect(() => parse(addAccountArgs, { kind: "Unknown", name: "Test" })).toThrow();
  });
  it("trims and rejects blank feed URL command args", () => {
    expect(parse(discoverFeedsArgs, { url: " https://example.com/feed.xml " })).toEqual({
      url: "https://example.com/feed.xml",
    });
    expect(
      parse(addLocalFeedArgs, {
        accountId: "acc-1",
        url: " https://example.com/feed.xml ",
      }),
    ).toEqual({
      accountId: "acc-1",
      url: "https://example.com/feed.xml",
    });

    expect(() => parse(discoverFeedsArgs, { url: "" })).toThrow();
    expect(() => parse(discoverFeedsArgs, { url: "   " })).toThrow();
    expect(() => parse(addLocalFeedArgs, { accountId: "acc-1", url: "" })).toThrow();
    expect(() => parse(addLocalFeedArgs, { accountId: "acc-1", url: "   " })).toThrow();
  });
  it.each([
    ["listFoldersArgs.accountId", listFoldersArgs, { accountId: " acc-1 " }, { accountId: "acc-1" }, "accountId"],
    ["listFeedsArgs.accountId", listFeedsArgs, { accountId: " acc-1 " }, { accountId: "acc-1" }, "accountId"],
    [
      "listFeedArticleSummariesArgs.accountId",
      listFeedArticleSummariesArgs,
      { accountId: " acc-1 " },
      { accountId: "acc-1" },
      "accountId",
    ],
    [
      "listAccountArticlesArgs.accountId",
      listAccountArticlesArgs,
      { accountId: " acc-1 " },
      { accountId: "acc-1" },
      "accountId",
    ],
    [
      "listStarredArticlesArgs.accountId",
      listStarredArticlesArgs,
      { accountId: " acc-1 " },
      { accountId: "acc-1" },
      "accountId",
    ],
    [
      "listRecentArticlesArgs.accountId",
      listRecentArticlesArgs,
      { accountId: " acc-1 " },
      { accountId: "acc-1" },
      "accountId",
    ],
    [
      "markAccountReadArgs.accountId",
      markAccountReadArgs,
      { accountId: " acc-1 " },
      { accountId: "acc-1" },
      "accountId",
    ],
    [
      "searchArticlesArgs.accountId",
      searchArticlesArgs,
      { accountId: " acc-1 ", query: "rust" },
      { accountId: "acc-1", query: "rust" },
      "accountId",
    ],
    [
      "recordArticleViewArgs.articleId",
      recordArticleViewArgs,
      { accountId: "acc-1", articleId: " article-1 " },
      { accountId: "acc-1", articleId: "article-1" },
      "articleId",
    ],
    [
      "recordArticleViewArgs.accountId",
      recordArticleViewArgs,
      { accountId: " acc-1 ", articleId: "article-1" },
      { accountId: "acc-1", articleId: "article-1" },
      "accountId",
    ],
    [
      "clearArticleViewHistoryArgs.accountId",
      clearArticleViewHistoryArgs,
      { accountId: " acc-1 " },
      { accountId: "acc-1" },
      "accountId",
    ],
    [
      "markArticleReadArgs.articleId",
      markArticleReadArgs,
      { articleId: " article-1 " },
      { articleId: "article-1" },
      "articleId",
    ],
    [
      "toggleArticleStarArgs.articleId",
      toggleArticleStarArgs,
      { articleId: " article-1 ", starred: true },
      { articleId: "article-1", starred: true },
      "articleId",
    ],
    ["markFeedReadArgs.feedId", markFeedReadArgs, { feedId: " feed-1 " }, { feedId: "feed-1" }, "feedId"],
    [
      "markFolderReadArgs.folderId",
      markFolderReadArgs,
      { folderId: " folder-1 " },
      { folderId: "folder-1" },
      "folderId",
    ],
    ["syncAccountArgs.accountId", syncAccountArgs, { accountId: " acc-1 " }, { accountId: "acc-1" }, "accountId"],
    [
      "getAccountSyncStatusArgs.accountId",
      getAccountSyncStatusArgs,
      { accountId: " acc-1 " },
      { accountId: "acc-1" },
      "accountId",
    ],
    ["deleteAccountArgs.accountId", deleteAccountArgs, { accountId: " acc-1 " }, { accountId: "acc-1" }, "accountId"],
    ["syncFeedArgs.feedId", syncFeedArgs, { feedId: " feed-1 " }, { feedId: "feed-1" }, "feedId"],
    [
      "addLocalFeedArgs.accountId",
      addLocalFeedArgs,
      { accountId: " acc-1 ", url: "https://example.com/feed.xml" },
      { accountId: "acc-1", url: "https://example.com/feed.xml" },
      "accountId",
    ],
    [
      "createFolderArgs.accountId",
      createFolderArgs,
      { accountId: " acc-1 ", name: "Reading" },
      { accountId: "acc-1", name: "Reading" },
      "accountId",
    ],
    ["deleteFeedArgs.feedId", deleteFeedArgs, { feedId: " feed-1 " }, { feedId: "feed-1" }, "feedId"],
    [
      "renameFeedArgs.feedId",
      renameFeedArgs,
      { feedId: " feed-1 ", title: "Title" },
      { feedId: "feed-1", title: "Title" },
      "feedId",
    ],
    [
      "updateFeedFolderArgs.feedId",
      updateFeedFolderArgs,
      { feedId: " feed-1 ", folderId: "folder-1" },
      { feedId: "feed-1", folderId: "folder-1" },
      "feedId",
    ],
    [
      "updateFeedDisplaySettingsArgs.feedId",
      updateFeedDisplaySettingsArgs,
      { feedId: " feed-1 ", readerMode: "inherit", webPreviewMode: "inherit" },
      { feedId: "feed-1", readerMode: "inherit", webPreviewMode: "inherit" },
      "feedId",
    ],
    [
      "renameTagArgs.tagId",
      renameTagArgs,
      { tagId: " tag-1 ", name: "News" },
      { tagId: "tag-1", name: "News" },
      "tagId",
    ],
    ["deleteTagArgs.tagId", deleteTagArgs, { tagId: " tag-1 " }, { tagId: "tag-1" }, "tagId"],
    [
      "tagArticleArgs.articleId",
      tagArticleArgs,
      { articleId: " article-1 ", tagId: "tag-1" },
      { articleId: "article-1", tagId: "tag-1" },
      "articleId",
    ],
    [
      "tagArticleArgs.tagId",
      tagArticleArgs,
      { articleId: "article-1", tagId: " tag-1 " },
      { articleId: "article-1", tagId: "tag-1" },
      "tagId",
    ],
    [
      "untagArticleArgs.articleId",
      untagArticleArgs,
      { articleId: " article-1 ", tagId: "tag-1" },
      { articleId: "article-1", tagId: "tag-1" },
      "articleId",
    ],
    [
      "untagArticleArgs.tagId",
      untagArticleArgs,
      { articleId: "article-1", tagId: " tag-1 " },
      { articleId: "article-1", tagId: "tag-1" },
      "tagId",
    ],
    [
      "getArticleTagsArgs.articleId",
      getArticleTagsArgs,
      { articleId: " article-1 " },
      { articleId: "article-1" },
      "articleId",
    ],
    ["listArticlesByTagArgs.tagId", listArticlesByTagArgs, { tagId: " tag-1 " }, { tagId: "tag-1" }, "tagId"],
    [
      "listArticlesByTagArgs.accountId",
      listArticlesByTagArgs,
      { tagId: "tag-1", accountId: " acc-1 " },
      { tagId: "tag-1", accountId: "acc-1" },
      "accountId",
    ],
    [
      "deleteMuteKeywordArgs.muteKeywordId",
      deleteMuteKeywordArgs,
      { muteKeywordId: " mute-1 " },
      { muteKeywordId: "mute-1" },
      "muteKeywordId",
    ],
    [
      "updateMuteKeywordArgs.muteKeywordId",
      updateMuteKeywordArgs,
      { muteKeywordId: " mute-1 ", scope: "title" },
      { muteKeywordId: "mute-1", scope: "title" },
      "muteKeywordId",
    ],
  ] as const)("keeps %s on the shared nonblank trimmed id contract", (_name, schema, input, expected, blankField) => {
    expect(parse(schema, input)).toEqual(expected);
    expect(() => parse(schema, { ...input, [blankField]: "" })).toThrow("Command id must not be blank");
    expect(() => parse(schema, { ...input, [blankField]: "   " })).toThrow("Command id must not be blank");
  });
  it("keeps markArticlesReadArgs ids on the shared nonblank trimmed id contract", () => {
    expect(parse(markArticlesReadArgs, { articleIds: [" article-1 "] })).toEqual({
      articleIds: ["article-1"],
    });
    expect(() => parse(markArticlesReadArgs, { articleIds: [""] })).toThrow("Command id must not be blank");
    expect(() => parse(markArticlesReadArgs, { articleIds: ["   "] })).toThrow("Command id must not be blank");
  });
  it("trims and rejects blank create folder names", () => {
    expect(
      parse(createFolderArgs, {
        accountId: "acc-1",
        name: " Reading ",
      }),
    ).toEqual({
      accountId: "acc-1",
      name: "Reading",
    });

    expect(() => parse(createFolderArgs, { accountId: "acc-1", name: "" })).toThrow();
    expect(() => parse(createFolderArgs, { accountId: "acc-1", name: "   " })).toThrow();
  });
  it("validates updateAccountSyncArgs numeric range", () => {
    const valid = {
      accountId: "acc-1",
      syncIntervalSecs: 3600,
      syncOnStartup: true,
      syncOnWake: false,
      keepReadItemsDays: 30,
    };

    expect(parse(updateAccountSyncArgs, valid)).toEqual(valid);
    expect(parse(updateAccountSyncArgs, { ...valid, syncIntervalSecs: 60 })).toEqual({
      ...valid,
      syncIntervalSecs: 60,
    });
    expect(parse(updateAccountSyncArgs, { ...valid, keepReadItemsDays: 3650 })).toEqual({
      ...valid,
      keepReadItemsDays: 3650,
    });
    expect(() => parse(updateAccountSyncArgs, { ...valid, syncIntervalSecs: 59 })).toThrow();
    expect(() => parse(updateAccountSyncArgs, { ...valid, syncIntervalSecs: 86_401 })).toThrow();
    expect(() => parse(updateAccountSyncArgs, { ...valid, syncIntervalSecs: 60.5 })).toThrow();
    expect(() => parse(updateAccountSyncArgs, { ...valid, keepReadItemsDays: 0 })).toThrow();
    expect(() => parse(updateAccountSyncArgs, { ...valid, keepReadItemsDays: 3651 })).toThrow();
    expect(() => parse(updateAccountSyncArgs, { ...valid, keepReadItemsDays: 30.5 })).toThrow();
  });
  it("parses createMuteKeywordArgs", () => {
    expect(
      parse(createMuteKeywordArgs, {
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
      parse(createMuteKeywordArgs, {
        keyword: " spoiler ",
        scope: "title",
      }),
    ).toEqual({
      keyword: "spoiler",
      scope: "title",
    });

    expect(() => parse(createMuteKeywordArgs, { keyword: "", scope: "title" })).toThrow();
    expect(() => parse(createMuteKeywordArgs, { keyword: "   ", scope: "title" })).toThrow();
  });
  it("parses deleteMuteKeywordArgs", () => {
    expect(parse(deleteMuteKeywordArgs, { muteKeywordId: "mute-1" })).toEqual({
      muteKeywordId: "mute-1",
    });
  });
  it("parses setMuteAutoMarkReadArgs", () => {
    expect(parse(setMuteAutoMarkReadArgs, { enabled: true })).toEqual({
      enabled: true,
    });
  });
  it("parses listFolderArticlesArgs", () => {
    expect(
      parse(listFolderArticlesArgs, {
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
    expect(parse(listFeedArticleSummariesArgs, { accountId: "acc-1" })).toEqual({
      accountId: "acc-1",
    });
  });
  it("normalizes updateFeedFolderArgs folder ids", () => {
    expect(parse(updateFeedFolderArgs, { feedId: "feed-1", folderId: null })).toEqual({
      feedId: "feed-1",
      folderId: null,
    });
    expect(parse(updateFeedFolderArgs, { feedId: "feed-1", folderId: "   " })).toEqual({
      feedId: "feed-1",
      folderId: null,
    });
    expect(parse(updateFeedFolderArgs, { feedId: "feed-1", folderId: " folder-1 " })).toEqual({
      feedId: "feed-1",
      folderId: "folder-1",
    });
  });
  it("parses listArticlesByTagArgs with mode", () => {
    expect(
      parse(listArticlesByTagArgs, {
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
      parse(searchArticlesArgs, {
        accountId: "acc-1",
        query: " fresh ",
      }),
    ).toEqual({
      accountId: "acc-1",
      query: "fresh",
    });

    expect(() => parse(searchArticlesArgs, { accountId: "acc-1", query: "" })).toThrow();
    expect(() => parse(searchArticlesArgs, { accountId: "acc-1", query: "   " })).toThrow();
  });
  it("keeps IPC pagination schemas aligned with Rust command boundaries", () => {
    expect(extractRustUsizeConst(readRustArticleCommandSource(), "MAX_ARTICLE_COMMAND_LIST_LIMIT")).toBe(
      MAX_IPC_PAGINATION_LIMIT,
    );
    expect(readRustTagCommandSource()).toContain(
      "article_command_pagination(offset, limit, DEFAULT_ARTICLE_LIST_LIMIT)",
    );
    expect(extractRustUsizeConst(readRustArticleCommandSource(), "MAX_ARTICLE_COMMAND_LIST_OFFSET")).toBe(
      MAX_IPC_PAGINATION_OFFSET,
    );
  });
  it("parses finite browser webview bounds and rejects invalid dimensions", () => {
    expect(
      parse(browserWebviewBoundsArgs, {
        x: 0,
        y: 12,
        width: 320,
        height: 240,
      }),
    ).toEqual({
      x: 0,
      y: 12,
      width: 320,
      height: 240,
    });
    expect(() =>
      parse(browserWebviewBoundsArgs, {
        x: 0.5,
        y: 12,
        width: 320,
        height: 240,
      }),
    ).toThrow();
    expect(() =>
      parse(browserWebviewBoundsArgs, {
        x: Number.NaN,
        y: 0,
        width: 320,
        height: 240,
      }),
    ).toThrow();
    expect(() =>
      parse(browserWebviewBoundsArgs, {
        x: 0,
        y: Number.POSITIVE_INFINITY,
        width: 320,
        height: 240,
      }),
    ).toThrow();
    expect(() => parse(browserWebviewBoundsArgs, { x: -1, y: 0, width: 320, height: 240 })).toThrow();
    expect(() =>
      parse(browserWebviewBoundsArgs, {
        x: 0,
        y: BROWSER_WEBVIEW_BOUNDS_MAX_VALUE + 1,
        width: 320,
        height: 240,
      }),
    ).toThrow();
    expect(() =>
      parse(browserWebviewBoundsArgs, {
        x: 0,
        y: 0,
        width: BROWSER_WEBVIEW_BOUNDS_MAX_VALUE + 1,
        height: 240,
      }),
    ).toThrow();
    expect(() => parse(browserWebviewBoundsArgs, { x: 0, y: 0, width: 0, height: 240 })).toThrow();
    expect(() => parse(browserWebviewBoundsArgs, { x: 0, y: 0, width: 320, height: -1 })).toThrow();
  });
  it("accepts only http or https Reading List URLs without CR/LF", () => {
    expect(parse(addToReadingListArgs, { url: "http://example.com/article" })).toEqual({
      url: "http://example.com/article",
    });
    expect(
      parse(addToReadingListArgs, {
        url: 'https://example.com/article?title="quoted"',
      }),
    ).toEqual({
      url: 'https://example.com/article?title="quoted"',
    });
    expect(
      parse(addToReadingListArgs, {
        url: " https://example.com/article ",
      }),
    ).toEqual({
      url: "https://example.com/article",
    });
    expect(() => parse(addToReadingListArgs, { url: "mailto:hello@example.com" })).toThrow();
    expect(() => parse(addToReadingListArgs, { url: "ftp://example.com/article" })).toThrow();
    expect(() => parse(addToReadingListArgs, { url: "" })).toThrow();
    expect(() => parse(addToReadingListArgs, { url: "   " })).toThrow();
    expect(() => parse(addToReadingListArgs, { url: "https://example.com/article\nnext" })).toThrow();
    expect(() => parse(addToReadingListArgs, { url: "https://example.com/article\rnext" })).toThrow();
  });
  it("keeps share command args covered by generated schemas", () => {
    expect(commandArgsSchemas.copy_to_clipboard).toBe(copyToClipboardArgs);
    expect(commandArgsSchemas.add_to_reading_list).toBe(addToReadingListArgs);
    expect(getCommandArgsSchema("copy_to_clipboard")).toBe(copyToClipboardArgs);
    expect(getCommandArgsSchema("add_to_reading_list")).toBe(addToReadingListArgs);
  });
  it("keeps share command validation aligned with native command boundaries", () => {
    const rustShareCommandSource = readFileSync(
      join(process.cwd(), "src-tauri/src/commands/share_commands.rs"),
      "utf8",
    );

    expect(extractRustUsizeConst(rustShareCommandSource, "CLIPBOARD_TEXT_MAX_CHARS")).toBe(
      SHARE_COMMAND_TEXT_MAX_CHARS,
    );
    expect(parse(copyToClipboardArgs, { text: "x".repeat(SHARE_COMMAND_TEXT_MAX_CHARS) })).toEqual({
      text: "x".repeat(SHARE_COMMAND_TEXT_MAX_CHARS),
    });
    expect(() => parse(copyToClipboardArgs, { text: "" })).toThrow();
    expect(() => parse(copyToClipboardArgs, { text: "   " })).toThrow();
    expect(() => parse(copyToClipboardArgs, { text: "first line\nsecond line" })).toThrow();
    expect(() => parse(copyToClipboardArgs, { text: "x".repeat(SHARE_COMMAND_TEXT_MAX_CHARS + 1) })).toThrow();
    expect(() => parse(addToReadingListArgs, { url: "mailto:hello@example.com" })).toThrow();
  });
  it("accepts mailto only at the external URL command boundary", () => {
    expect(
      parse(openExternalUrlArgs, {
        url: "mailto:?subject=First&body=https%3A%2F%2Fexample.com",
      }),
    ).toEqual({
      url: "mailto:?subject=First&body=https%3A%2F%2Fexample.com",
    });
    expect(parse(openExternalUrlArgs, { url: "https://example.com/article" })).toEqual({
      url: "https://example.com/article",
    });
    expect(
      parse(openExternalUrlArgs, {
        url: " mailto:?subject=First&body=https%3A%2F%2Fexample.com ",
      }),
    ).toEqual({
      url: "mailto:?subject=First&body=https%3A%2F%2Fexample.com",
    });
    expect(parse(openExternalUrlArgs, { url: " https://example.com/article " })).toEqual({
      url: "https://example.com/article",
    });
    expect(() => parse(openExternalUrlArgs, { url: "ftp://example.com/article" })).toThrow();
    expect(() => parse(openExternalUrlArgs, { url: "" })).toThrow();
    expect(() => parse(openExternalUrlArgs, { url: "   " })).toThrow();
    expect(() => parse(openExternalUrlArgs, { url: "mailto:?subject=First\nbody=Bad" })).toThrow();
  });
  it("accepts only http or https open-in-browser URLs without CR/LF", () => {
    expect(
      parse(commandArgsSchemas.open_in_browser, {
        url: " https://example.com/article ",
        background: true,
      }),
    ).toEqual({
      url: "https://example.com/article",
      background: true,
    });
    expect(() => parse(commandArgsSchemas.open_in_browser, { url: "" })).toThrow();
    expect(() => parse(commandArgsSchemas.open_in_browser, { url: "   " })).toThrow();
    expect(() =>
      parse(commandArgsSchemas.open_in_browser, {
        url: "https://example.com/article\nnext",
      }),
    ).toThrow();
    expect(() =>
      parse(commandArgsSchemas.open_in_browser, {
        url: "mailto:hello@example.com",
      }),
    ).toThrow();
    expect(() =>
      parse(commandArgsSchemas.open_in_browser, {
        url: "file:///tmp/article.html",
      }),
    ).toThrow();
  });
  it("rejects unknown shortcut preference keys and validates known shortcut values", () => {
    expect(
      parse(setPreferenceArgs, {
        key: "shortcut_next_article",
        value: "Shift+J",
      }),
    ).toEqual({
      key: "shortcut_next_article",
      value: "Shift+J",
    });
    expect(() => parse(setPreferenceArgs, { key: "shortcut_unknown_action", value: "x" })).toThrow();
    expect(() => parse(setPreferenceArgs, { key: "shortcut_next_article", value: "   " })).toThrow();
    expect(parse(setPreferenceArgs, { key: "selected_account_id", value: "acc-1" })).toEqual({
      key: "selected_account_id",
      value: "acc-1",
    });
  });
  it("validates known preference values while preserving backend-only and unknown passthrough keys", () => {
    expect(parse(setPreferenceArgs, { key: "theme", value: "dark" })).toEqual({
      key: "theme",
      value: "dark",
    });
    expect(parse(setPreferenceArgs, { key: "debug_web_preview_url", value: "" })).toEqual({
      key: "debug_web_preview_url",
      value: "",
    });
    expect(
      parse(setPreferenceArgs, {
        key: "custom_backend_preference",
        value: "preserved",
      }),
    ).toEqual({
      key: "custom_backend_preference",
      value: "preserved",
    });

    expect(() => parse(setPreferenceArgs, { key: "theme", value: "sepia" })).toThrow();
    expect(() => parse(setPreferenceArgs, { key: "sync_on_startup", value: "yes" })).toThrow();
    expect(() => parse(setPreferenceArgs, { key: "selected_account_id", value: "" })).toThrow();
  });
  it("rejects non-displayable shortcut preference values", () => {
    expect(() => parse(setPreferenceArgs, { key: "shortcut_next_article", value: "k\n" })).toThrow();
    expect(() =>
      parse(setPreferenceArgs, {
        key: "shortcut_next_article",
        value: "k\u0000",
      }),
    ).toThrow();
    expect(() =>
      parse(setPreferenceArgs, {
        key: "shortcut_next_article",
        value: "\u001B",
      }),
    ).toThrow();
  });
  it("keeps preference value max length aligned to the backend UTF-8 byte limit", () => {
    const maxUtf8Value = `${"あ".repeat(341)}a`;

    expect(
      parse(setPreferenceArgs, {
        key: "debug_web_preview_url",
        value: "a".repeat(1024),
      }),
    ).toEqual({
      key: "debug_web_preview_url",
      value: "a".repeat(1024),
    });
    expect(new TextEncoder().encode(maxUtf8Value).length).toBe(1024);
    expect(
      parse(setPreferenceArgs, {
        key: "debug_web_preview_url",
        value: maxUtf8Value,
      }),
    ).toEqual({
      key: "debug_web_preview_url",
      value: maxUtf8Value,
    });
    expect(() =>
      parse(setPreferenceArgs, {
        key: "debug_web_preview_url",
        value: "a".repeat(1025),
      }),
    ).toThrow();
    expect(() =>
      parse(setPreferenceArgs, {
        key: "debug_web_preview_url",
        value: "あ".repeat(342),
      }),
    ).toThrow();
  });
  it("keeps sync result numeric fields nonnegative integers", () => {
    const valid = {
      synced: true,
      total: 1,
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

    expect(parse(SyncResultSchema, valid)).toEqual(valid);
    expect(
      parse(SyncResultSchema, {
        ...valid,
        total: 2,
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
      total: 2,
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
    expect(() => parse(SyncResultSchema, { ...valid, total: -1 })).toThrow();
    expect(() => parse(SyncResultSchema, { ...valid, total: 1.5 })).toThrow();
    expect(() => parse(SyncResultSchema, { ...valid, succeeded: Number.POSITIVE_INFINITY })).toThrow();
    expect(
      parse(SyncResultSchema, {
        ...valid,
        total: 2,
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
      parse(SyncResultSchema, {
        ...valid,
        warnings: [{ ...valid.warnings[0], message: "   " }],
      }),
    ).toThrow();
    expect(() =>
      parse(SyncResultSchema, {
        ...valid,
        warnings: [{ ...valid.warnings[0], retry_in_seconds: 0.5 }],
      }),
    ).toThrow();
    expect(() =>
      parse(SyncResultSchema, {
        ...valid,
        warnings: [{ ...valid.warnings[0], retry_at: "2026-04-15" }],
      }),
    ).toThrow();
    expect(() =>
      parse(SyncResultSchema, {
        ...valid,
        warnings: [{ ...valid.warnings[0], retry_at: "2026-04-15T01:00:00" }],
      }),
    ).toThrow();
    expect(() =>
      parse(SyncResultSchema, {
        ...valid,
        warnings: [{ ...valid.warnings[0], retry_at: "not-a-date" }],
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
    expect(commandArgsSchemas.copy_to_clipboard).toBe(copyToClipboardArgs);
    expect(commandArgsSchemas.add_to_reading_list).toBe(addToReadingListArgs);
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

    expectSortedKeysForTarget("commandArgsSchemas", Object.keys(commandArgsSchemas), commandsWithArgs);
  });

  it("keeps Tauri command response schemas imported from the API schema barrel connected to safeInvoke", () => {
    const tauriCommandsSource = readTauriCommandsSource();
    const importedSchemaNames = extractImportedApiSchemaNamesFromTauriCommands(tauriCommandsSource);
    const responseSchemaNames = extractSafeInvokeResponseSchemaNames(tauriCommandsSource);
    const nonResponseSchemaImports = new Set(["AppErrorSchema"]);

    const unusedImportedSchemas = importedSchemaNames.filter(
      (schemaName) => !responseSchemaNames.includes(schemaName) && !nonResponseSchemaImports.has(schemaName),
    );

    expect(unusedImportedSchemas).toEqual([]);
  });

  it("keeps every safeInvoke command response backed by an API schema barrel export", () => {
    const barrelSchemaExports = extractSchemaNamesFromSource(readApiSchemaBarrelSource());
    const tauriCommandsSource = readTauriCommandsSource();
    const responseSchemaNames = extractSafeInvokeResponseSchemaNames(tauriCommandsSource);
    const importedSchemaNames = extractImportedApiSchemaNamesFromTauriCommands(tauriCommandsSource);

    expect(responseSchemaNames).toHaveLength(extractSafeInvokeCommandCallCount(tauriCommandsSource));
    expect(responseSchemaNames.filter((schemaName) => !importedSchemaNames.includes(schemaName))).toEqual([]);
    expect(responseSchemaNames.filter((schemaName) => !barrelSchemaExports.includes(schemaName))).toEqual([]);
  });

  it("keeps generated command args schemas backed by Rust command names", () => {
    const rustCommands = new Set(extractRustTauriCommandNames(readRustCommandSources()));
    const pluginCommandExceptions = new Set(["plugin:opener|open_url"]);
    const schemaCommands = Object.keys(commandArgsSchemas).filter((command) => !pluginCommandExceptions.has(command));
    const missingRustCommands = schemaCommands.filter((command) => !rustCommands.has(command));

    expect(missingRustCommands).toEqual([]);
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

  it("extracts Rust Tauri command names with stable sorting and duplicate removal", () => {
    expect(
      extractRustTauriCommandNames(`
        #[tauri::command]
        pub fn beta_command() {}

        #[tauri::command]
        pub async fn alpha_command() {}

        #[tauri::command]
        pub async fn alpha_command() {}
      `),
    ).toEqual(["alpha_command", "beta_command"]);
  });
});
