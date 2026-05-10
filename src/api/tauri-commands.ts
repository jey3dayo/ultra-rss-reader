import { Result } from "@praha/byethrow";
import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  type AccountDto,
  AccountDtoListSchema,
  AccountDtoSchema,
  type AccountSyncStatusDto,
  AccountSyncStatusSchema,
  type AppError,
  AppErrorSchema,
  type ArticleDto,
  ArticleDtoListSchema,
  type ArticleListMode,
  addAccountArgs,
  addLocalFeedArgs,
  addToReadingListArgs,
  BooleanResponseSchema,
  type BrowserWebviewState,
  BrowserWebviewStateSchema,
  CountResponseSchema,
  checkBrowserEmbedSupportArgs,
  cleanupFeedIntegrityOrphansArgs,
  clearArticleViewHistoryArgs,
  copyToClipboardArgs,
  countAccountStarredArticlesArgs,
  countAccountUnreadArticlesArgs,
  createFolderArgs,
  createMuteKeywordArgs,
  createOrUpdateBrowserWebviewArgs,
  createTagArgs,
  type DatabaseInfoDto,
  DatabaseInfoDtoSchema,
  type DevRuntimeOptions,
  DevRuntimeOptionsSchema,
  type DiscoveredFeedDto,
  DiscoveredFeedDtoListSchema,
  deleteAccountArgs,
  deleteFeedArgs,
  deleteMuteKeywordArgs,
  deleteTagArgs,
  discoverFeedsArgs,
  exportOpmlArgs,
  FeedArticleSummaryDtoListSchema,
  type FeedDto,
  FeedDtoListSchema,
  FeedDtoSchema,
  type FeedIntegrityCleanupDto,
  FeedIntegrityCleanupDtoSchema,
  type FeedIntegrityReportDto,
  FeedIntegrityReportDtoSchema,
  type FolderDto,
  FolderDtoListSchema,
  FolderDtoSchema,
  getAccountSyncStatusArgs,
  getArticleTagsArgs,
  getTagArticleCountsArgs,
  listAccountArticlesArgs,
  listArticlesArgs,
  listArticlesByTagArgs,
  listFeedArticleSummariesArgs,
  listFeedsArgs,
  listFolderArticlesArgs,
  listFoldersArgs,
  listRecentArticlesArgs,
  listStarredArticlesArgs,
  type MuteKeywordDto,
  MuteKeywordDtoListSchema,
  MuteKeywordDtoSchema,
  type MuteKeywordScope,
  markAccountReadArgs,
  markArticleReadArgs,
  markArticlesReadArgs,
  markFeedReadArgs,
  markFolderReadArgs,
  NonnegativeIntResponseSchema,
  NullableStarredArticlesSchema,
  NullableStarredCountSchema,
  NullResponseSchema,
  type OldUnreadDays,
  type OldUnreadScopeKind,
  oldUnreadArticlesArgs,
  openExternalUrlArgs,
  openInBrowserArgs,
  type PlatformPermissionDeniedRecovery,
  PlatformPermissionDeniedRecoveryListSchema,
  type PlatformInfo,
  PlatformInfoSchema,
  type PreferencesDto,
  PreferencesDtoSchema,
  recordArticleViewArgs,
  renameAccountArgs,
  renameFeedArgs,
  renameTagArgs,
  StringResponseSchema,
  SyncResultSchema,
  searchArticlesArgs,
  setBrowserWebviewBoundsArgs,
  setMuteAutoMarkReadArgs,
  setPreferenceArgs,
  startupSyncArgs,
  syncAccountArgs,
  syncFeedArgs,
  TagArticleCountsSchema,
  type TagDto,
  TagDtoListSchema,
  TagDtoSchema,
  tagArticleArgs,
  testAccountConnectionArgs,
  toggleArticleStarArgs,
  type UpdateInfoDto,
  UpdateInfoDtoSchema,
  unstarAccountArticlesArgs,
  untagArticleArgs,
  updateAccountCredentialsArgs,
  updateAccountSyncArgs,
  updateFeedDisplaySettingsArgs,
  updateFeedFolderArgs,
  updateMuteKeywordArgs,
} from "@/api/schemas";
import type { BrowserWebviewBounds } from "@/lib/browser/browser-webview";
import { createSchemaParseAppError, RESPONSE_VALIDATION_MESSAGE } from "@/lib/ui-errors";
import { parseWithSchema } from "@/schemas/parse";

// Re-export types so existing consumers don't break
export type {
  AccountDto,
  AccountSyncStatusDto,
  AppError,
  ArticleDto,
  BrowserWebviewState,
  DatabaseInfoDto,
  DevRuntimeOptions,
  DiscoveredFeedDto,
  FeedDto,
  FeedIntegrityCleanupDto,
  FeedIntegrityReportDto,
  FolderDto,
  MuteKeywordDto,
  OldUnreadDays,
  OldUnreadScopeKind,
  PlatformPermissionDeniedRecovery,
  PlatformInfo,
  PreferencesDto,
  TagDto,
  UpdateInfoDto,
};

// --- safeInvoke infrastructure ---

type InvokeArgsRecord = Record<string, unknown>;

type InvokeArgsSchema = z.ZodType<InvokeArgsRecord>;

type InvokeArgsOptions = {
  args?: InvokeArgsSchema;
};

type SchemaBackedInvokeOptions<R extends z.ZodType> = InvokeArgsOptions & {
  response: R;
};

type GenericInvokeOptions = InvokeArgsOptions;

const URL_LIKE_TOKEN_PATTERN = /https?:\/\/[^\s<>"'`]+/gi;
const SECRET_URL_PATH_SEGMENT_PATTERN = /(?:token|secret|password|credential|private[-_]?key|api[-_]?key)/i;
const VALIDATION_ISSUE_LIMIT = 3;
const VALIDATION_DETAIL_MAX_LENGTH = 240;

class ResponseValidationError extends Error {
  readonly cause: z.ZodError;

  constructor(cause: z.ZodError) {
    super(RESPONSE_VALIDATION_MESSAGE);
    this.name = "ResponseValidationError";
    this.cause = cause;
  }
}

function redactUrlToken(value: string): string {
  const trailingPunctuation = value.match(/[),.;!?]+$/)?.[0] ?? "";
  const urlToken = trailingPunctuation ? value.slice(0, -trailingPunctuation.length) : value;

  try {
    const url = new URL(urlToken);
    url.username = "";
    url.password = "";
    if (
      url.pathname !== "/" &&
      url.pathname.split("/").some((segment) => SECRET_URL_PATH_SEGMENT_PATTERN.test(segment))
    ) {
      url.pathname = "/redacted";
    }
    if (url.search) {
      url.search = "?redacted";
    }
    if (url.hash) {
      url.hash = "#redacted";
    }
    return `${url.toString()}${trailingPunctuation}`;
  } catch {
    return value;
  }
}

function redactSensitiveRuntimeMessage(message: string): string {
  return message.replace(URL_LIKE_TOKEN_PATTERN, redactUrlToken);
}

function runtimeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatZodIssuePath(path: ReadonlyArray<PropertyKey>): string {
  return path.length > 0 ? path.join(".") : "<root>";
}

function limitValidationDetail(detail: string): string {
  return detail.length <= VALIDATION_DETAIL_MAX_LENGTH ? detail : `${detail.slice(0, VALIDATION_DETAIL_MAX_LENGTH)}...`;
}

function formatZodIssues(error: z.ZodError): string {
  const issues = error.issues.slice(0, VALIDATION_ISSUE_LIMIT).map((issue) => {
    return `${formatZodIssuePath(issue.path)}: ${issue.message}`;
  });
  const omittedCount = error.issues.length - issues.length;
  if (omittedCount > 0) {
    issues.push(`${omittedCount} more issue(s) omitted`);
  }
  return limitValidationDetail(redactSensitiveRuntimeMessage(issues.join(", ")));
}

function redactAppError(error: AppError): AppError {
  return {
    ...error,
    message: redactSensitiveRuntimeMessage(error.message),
  };
}

function toAppError(cmd: string, error: unknown): AppError {
  if (error instanceof ResponseValidationError) {
    const detail = formatZodIssues(error.cause);
    console.error(`[tauri-commands] ${cmd} response validation failed:`, detail);
    return createSchemaParseAppError("response", detail);
  }

  if (error instanceof z.ZodError) {
    const detail = formatZodIssues(error);
    console.error(`[tauri-commands] ${cmd} args validation failed:`, detail);
    return createSchemaParseAppError("args", detail);
  }
  const result = AppErrorSchema.safeParse(error);
  if (result.success) {
    const appError = redactAppError(result.data);
    console.error(`[tauri-commands] ${cmd} failed:`, appError);
    return appError;
  }

  const message = redactSensitiveRuntimeMessage(runtimeErrorMessage(error));
  console.error(`[tauri-commands] ${cmd} failed:`, message);
  return { type: "UserVisible", message };
}

function validateInvokeArgs(options: InvokeArgsOptions, args?: InvokeArgsRecord): InvokeArgsRecord | undefined {
  // Throwing is contained here because safeInvoke converts ZodError into AppError Result.
  return options.args && args ? parseWithSchema(options.args, args) : args;
}

function hasResponseSchema<R extends z.ZodType>(
  options: GenericInvokeOptions | SchemaBackedInvokeOptions<R>,
): options is SchemaBackedInvokeOptions<R> {
  return "response" in options;
}

async function invokeWithResponseSchema<R extends z.ZodType>(
  cmd: string,
  options: SchemaBackedInvokeOptions<R>,
  args?: InvokeArgsRecord,
): Promise<z.output<R>> {
  const validatedArgs = validateInvokeArgs(options, args);
  const raw = await invoke<unknown>(cmd, validatedArgs);
  try {
    // Response parse is diagnostics-only once it leaves safeInvoke.
    return parseWithSchema(options.response, raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ResponseValidationError(error);
    }
    throw error;
  }
}

async function invokeWithoutResponseSchema<T>(
  cmd: string,
  options: GenericInvokeOptions,
  args?: InvokeArgsRecord,
): Promise<T> {
  const validatedArgs = validateInvokeArgs(options, args);
  return invoke<T>(cmd, validatedArgs);
}

function safeInvoke<R extends z.ZodType>(
  cmd: string,
  options: SchemaBackedInvokeOptions<R>,
  args?: InvokeArgsRecord,
): Result.ResultAsync<z.output<R>, AppError>;

function safeInvoke<T = unknown>(
  cmd: string,
  options?: GenericInvokeOptions,
  args?: InvokeArgsRecord,
): Result.ResultAsync<T, AppError>;

function safeInvoke<R extends z.ZodType, T = unknown>(
  cmd: string,
  options: GenericInvokeOptions | SchemaBackedInvokeOptions<R> = {},
  args?: InvokeArgsRecord,
): Result.ResultAsync<unknown, AppError> {
  return Result.try({
    try: async () => {
      return hasResponseSchema(options)
        ? invokeWithResponseSchema(cmd, options, args)
        : invokeWithoutResponseSchema<T>(cmd, options, args);
    },
    catch: (error) => toAppError(cmd, error),
  });
}

// --- Commands ---

export const listAccounts = () => safeInvoke("list_accounts", { response: AccountDtoListSchema });

export const listFolders = (accountId: string) =>
  safeInvoke("list_folders", { response: FolderDtoListSchema, args: listFoldersArgs }, { accountId });

export const listFeeds = (accountId: string) =>
  safeInvoke("list_feeds", { response: FeedDtoListSchema, args: listFeedsArgs }, { accountId });

export const listArticles = (
  feedId: string,
  unreadOnlyOrOffset?: boolean | number,
  offsetOrLimit?: number,
  limit?: number,
) => {
  const unreadOnly = typeof unreadOnlyOrOffset === "boolean" ? unreadOnlyOrOffset : undefined;
  const offset = typeof unreadOnlyOrOffset === "number" ? unreadOnlyOrOffset : offsetOrLimit;
  const resolvedLimit = typeof unreadOnlyOrOffset === "number" ? offsetOrLimit : limit;

  return safeInvoke(
    "list_articles",
    { response: ArticleDtoListSchema, args: listArticlesArgs },
    { feedId, unreadOnly, offset, limit: resolvedLimit },
  );
};

export const listFeedStarredArticles = (feedId: string, offset?: number, limit?: number) =>
  safeInvoke(
    "list_articles",
    { response: ArticleDtoListSchema, args: listArticlesArgs },
    { feedId, starredOnly: true, offset, limit },
  );

export const listAccountArticles = (
  accountId: string,
  unreadOnlyOrOffset?: boolean | number,
  offsetOrLimit?: number,
  limit?: number,
) => {
  const unreadOnly = typeof unreadOnlyOrOffset === "boolean" ? unreadOnlyOrOffset : undefined;
  const offset = typeof unreadOnlyOrOffset === "number" ? unreadOnlyOrOffset : offsetOrLimit;
  const resolvedLimit = typeof unreadOnlyOrOffset === "number" ? offsetOrLimit : limit;

  return safeInvoke(
    "list_account_articles",
    { response: ArticleDtoListSchema, args: listAccountArticlesArgs },
    { accountId, unreadOnly, offset, limit: resolvedLimit },
  );
};

export const listFeedArticleSummaries = (accountId: string) =>
  safeInvoke(
    "list_feed_article_summaries",
    {
      response: FeedArticleSummaryDtoListSchema,
      args: listFeedArticleSummariesArgs,
    },
    { accountId },
  );

export const listFolderArticles = (folderId: string, mode: ArticleListMode = "all", offset?: number, limit?: number) =>
  safeInvoke(
    "list_folder_articles",
    { response: ArticleDtoListSchema, args: listFolderArticlesArgs },
    { folderId, mode, offset, limit },
  );

export const listStarredArticles = (accountId: string, offset?: number, limit?: number) =>
  safeInvoke(
    "list_starred_articles",
    { response: NullableStarredArticlesSchema, args: listStarredArticlesArgs },
    { accountId, offset, limit },
  );

export const listRecentArticles = (accountId: string, offset?: number, limit?: number, mode?: ArticleListMode) =>
  safeInvoke(
    "list_recent_articles",
    { response: ArticleDtoListSchema, args: listRecentArticlesArgs },
    { accountId, offset, limit, mode },
  );

export const countAccountUnreadArticles = (accountId: string) =>
  safeInvoke(
    "count_account_unread_articles",
    { response: CountResponseSchema, args: countAccountUnreadArticlesArgs },
    { accountId },
  );

export const countAccountStarredArticles = (accountId: string) =>
  safeInvoke(
    "count_account_starred_articles",
    {
      response: NullableStarredCountSchema,
      args: countAccountStarredArticlesArgs,
    },
    { accountId },
  );

export const markAccountRead = (accountId: string) =>
  safeInvoke("mark_account_read", { response: NullResponseSchema, args: markAccountReadArgs }, { accountId });

export const markAccountStarredRead = (accountId: string) =>
  safeInvoke("mark_account_starred_read", { response: NullResponseSchema, args: markAccountReadArgs }, { accountId });

export const countOldUnreadArticles = (scopeKind: OldUnreadScopeKind, targetId: string, olderThanDays: OldUnreadDays) =>
  safeInvoke(
    "count_old_unread_articles",
    { response: CountResponseSchema, args: oldUnreadArticlesArgs },
    { scopeKind, targetId, olderThanDays },
  );

export const markOldUnreadRead = (scopeKind: OldUnreadScopeKind, targetId: string, olderThanDays: OldUnreadDays) =>
  safeInvoke(
    "mark_old_unread_read",
    { response: NullResponseSchema, args: oldUnreadArticlesArgs },
    { scopeKind, targetId, olderThanDays },
  );

export const unstarAccountArticles = (accountId: string) =>
  safeInvoke(
    "unstar_account_articles",
    { response: NullResponseSchema, args: unstarAccountArticlesArgs },
    { accountId },
  );

export const getFeedIntegrityReport = () =>
  safeInvoke("get_feed_integrity_report", {
    response: FeedIntegrityReportDtoSchema,
  });

export const cleanupFeedIntegrityOrphans = (dryRun: boolean) =>
  safeInvoke(
    "cleanup_feed_integrity_orphans",
    {
      response: FeedIntegrityCleanupDtoSchema,
      args: cleanupFeedIntegrityOrphansArgs,
    },
    { dryRun },
  );

export const markArticleRead = (articleId: string, read = true) =>
  safeInvoke("mark_article_read", { response: NullResponseSchema, args: markArticleReadArgs }, { articleId, read });

export const recordArticleView = (accountId: string, articleId: string) =>
  safeInvoke(
    "record_article_view",
    { response: NullResponseSchema, args: recordArticleViewArgs },
    { accountId, articleId },
  );

export const clearArticleViewHistory = (accountId: string) =>
  safeInvoke(
    "clear_article_view_history",
    {
      response: NonnegativeIntResponseSchema,
      args: clearArticleViewHistoryArgs,
    },
    { accountId },
  );

export const markArticlesRead = (articleIds: string[]) =>
  safeInvoke("mark_articles_read", { response: NullResponseSchema, args: markArticlesReadArgs }, { articleIds });

export const toggleArticleStar = (articleId: string, starred: boolean) =>
  safeInvoke(
    "toggle_article_star",
    { response: NullResponseSchema, args: toggleArticleStarArgs },
    { articleId, starred },
  );

export const markFeedRead = (feedId: string) =>
  safeInvoke("mark_feed_read", { response: NullResponseSchema, args: markFeedReadArgs }, { feedId });

export const markFolderRead = (folderId: string) =>
  safeInvoke("mark_folder_read", { response: NullResponseSchema, args: markFolderReadArgs }, { folderId });

export const searchArticles = (accountId: string, query: string, offset?: number, limit?: number) =>
  safeInvoke(
    "search_articles",
    { response: ArticleDtoListSchema, args: searchArticlesArgs },
    { accountId, query, offset, limit },
  );

export const listMuteKeywords = () => safeInvoke("list_mute_keywords", { response: MuteKeywordDtoListSchema });

export const createMuteKeyword = (keyword: string, scope: MuteKeywordScope) =>
  safeInvoke(
    "create_mute_keyword",
    { response: MuteKeywordDtoSchema, args: createMuteKeywordArgs },
    { keyword, scope },
  );

export const updateMuteKeyword = (muteKeywordId: string, scope: MuteKeywordScope) =>
  safeInvoke(
    "update_mute_keyword",
    { response: MuteKeywordDtoSchema, args: updateMuteKeywordArgs },
    { muteKeywordId, scope },
  );

export const deleteMuteKeyword = (muteKeywordId: string) =>
  safeInvoke("delete_mute_keyword", { response: NullResponseSchema, args: deleteMuteKeywordArgs }, { muteKeywordId });

export const setMuteAutoMarkRead = (enabled: boolean) =>
  safeInvoke("set_mute_auto_mark_read", { response: NullResponseSchema, args: setMuteAutoMarkReadArgs }, { enabled });

export const addAccount = (kind: string, name: string, serverUrl?: string, username?: string, password?: string) =>
  safeInvoke(
    "add_account",
    { response: AccountDtoSchema, args: addAccountArgs },
    { kind, name, serverUrl, username, password },
  );

export const updateAccountSync = (
  accountId: string,
  syncIntervalSecs: number,
  syncOnStartup: boolean,
  syncOnWake: boolean,
  keepReadItemsDays: number,
) =>
  safeInvoke(
    "update_account_sync",
    { response: AccountDtoSchema, args: updateAccountSyncArgs },
    {
      accountId,
      syncIntervalSecs,
      syncOnStartup,
      syncOnWake,
      keepReadItemsDays,
    },
  );

export const updateAccountCredentials = (accountId: string, serverUrl?: string, username?: string, password?: string) =>
  safeInvoke(
    "update_account_credentials",
    { response: AccountDtoSchema, args: updateAccountCredentialsArgs },
    { accountId, serverUrl, username, password },
  );

export const renameAccount = (accountId: string, name: string) =>
  safeInvoke("rename_account", { response: AccountDtoSchema, args: renameAccountArgs }, { accountId, name });

export const testAccountConnection = (accountId: string) =>
  safeInvoke("test_account_connection", { response: AccountDtoSchema, args: testAccountConnectionArgs }, { accountId });

export const deleteAccount = (accountId: string) =>
  safeInvoke("delete_account", { response: NullResponseSchema, args: deleteAccountArgs }, { accountId });

export const getAccountSyncStatus = (accountId: string) =>
  safeInvoke(
    "get_account_sync_status",
    { response: AccountSyncStatusSchema, args: getAccountSyncStatusArgs },
    { accountId },
  );

export const discoverFeeds = (url: string) =>
  safeInvoke("discover_feeds", { response: DiscoveredFeedDtoListSchema, args: discoverFeedsArgs }, { url });

export const addLocalFeed = (accountId: string, url: string) =>
  safeInvoke("add_local_feed", { response: FeedDtoSchema, args: addLocalFeedArgs }, { accountId, url });

export const createFolder = (accountId: string, name: string) =>
  safeInvoke("create_folder", { response: FolderDtoSchema, args: createFolderArgs }, { accountId, name });

export const deleteFeed = (feedId: string) =>
  safeInvoke("delete_feed", { response: NullResponseSchema, args: deleteFeedArgs }, { feedId });

export const renameFeed = (feedId: string, title: string) =>
  safeInvoke("rename_feed", { response: NullResponseSchema, args: renameFeedArgs }, { feedId, title });

export const updateFeedFolder = (feedId: string, folderId: string | null) =>
  safeInvoke("update_feed_folder", { response: NullResponseSchema, args: updateFeedFolderArgs }, { feedId, folderId });

export const updateFeedDisplaySettings = (feedId: string, readerMode: string, webPreviewMode: string) =>
  safeInvoke(
    "update_feed_display_settings",
    { response: NullResponseSchema, args: updateFeedDisplaySettingsArgs },
    { feedId, readerMode, webPreviewMode },
  );

export const openInBrowser = (url: string, background?: boolean) =>
  safeInvoke("open_in_browser", { response: NullResponseSchema, args: openInBrowserArgs }, { url, background });

// Runtime is owned by the Rust tauri-plugin-opener registration; TS only needs the invoke command contract.
export const openExternalUrl = (url: string) =>
  safeInvoke("plugin:opener|open_url", { response: NullResponseSchema, args: openExternalUrlArgs }, { url });

export const checkBrowserEmbedSupport = (url: string) =>
  safeInvoke(
    "check_browser_embed_support",
    { response: BooleanResponseSchema, args: checkBrowserEmbedSupportArgs },
    { url },
  );

export const createOrUpdateBrowserWebview = (url: string, bounds: BrowserWebviewBounds) =>
  safeInvoke(
    "create_or_update_browser_webview",
    {
      response: BrowserWebviewStateSchema,
      args: createOrUpdateBrowserWebviewArgs,
    },
    { url, bounds },
  );

export const setBrowserWebviewBounds = (bounds: BrowserWebviewBounds) =>
  safeInvoke(
    "set_browser_webview_bounds",
    { response: NullResponseSchema, args: setBrowserWebviewBoundsArgs },
    { bounds },
  );

export const focusBrowserWebview = () => safeInvoke("focus_browser_webview", { response: NullResponseSchema });

export const goBackBrowserWebview = () =>
  safeInvoke("go_back_browser_webview", {
    response: BrowserWebviewStateSchema,
  });

export const goForwardBrowserWebview = () =>
  safeInvoke("go_forward_browser_webview", {
    response: BrowserWebviewStateSchema,
  });

export const reloadBrowserWebview = () => safeInvoke("reload_browser_webview", { response: BrowserWebviewStateSchema });

export const closeBrowserWebview = () => safeInvoke("close_browser_webview", { response: NullResponseSchema });

export const triggerSync = () => safeInvoke("trigger_sync", { response: SyncResultSchema });

export const triggerStartupSync = (preferredAccountId?: string) =>
  safeInvoke("trigger_startup_sync", { response: SyncResultSchema, args: startupSyncArgs }, { preferredAccountId });

export const triggerAutomaticSync = () => safeInvoke("trigger_automatic_sync", { response: SyncResultSchema });

export const syncAccount = (accountId: string) =>
  safeInvoke("trigger_sync_account", { response: SyncResultSchema, args: syncAccountArgs }, { accountId });

export const syncFeed = (feedId: string) =>
  safeInvoke("trigger_sync_feed", { response: SyncResultSchema, args: syncFeedArgs }, { feedId });

export const exportOpml = (accountId: string) =>
  safeInvoke("export_opml", { response: StringResponseSchema, args: exportOpmlArgs }, { accountId });

export const getPreferences = () => safeInvoke("get_preferences", { response: PreferencesDtoSchema });

export const setPreference = (key: string, value: string) =>
  safeInvoke("set_preference", { response: NullResponseSchema, args: setPreferenceArgs }, { key, value });

// Tags
export const listTags = () => safeInvoke("list_tags", { response: TagDtoListSchema });

export const createTag = (name: string, color?: string) =>
  safeInvoke("create_tag", { response: TagDtoSchema, args: createTagArgs }, { name, color });

export const renameTag = (tagId: string, name: string, color?: string | null) =>
  safeInvoke("rename_tag", { response: TagDtoSchema, args: renameTagArgs }, { tagId, name, color });

export const deleteTag = (tagId: string) =>
  safeInvoke("delete_tag", { response: NullResponseSchema, args: deleteTagArgs }, { tagId });

export const tagArticle = (articleId: string, tagId: string) =>
  safeInvoke("tag_article", { response: NullResponseSchema, args: tagArticleArgs }, { articleId, tagId });

export const untagArticle = (articleId: string, tagId: string) =>
  safeInvoke("untag_article", { response: NullResponseSchema, args: untagArticleArgs }, { articleId, tagId });

export const getArticleTags = (articleId: string) =>
  safeInvoke("get_article_tags", { response: TagDtoListSchema, args: getArticleTagsArgs }, { articleId });

export const listArticlesByTag = (
  tagId: string,
  offset?: number,
  limit?: number,
  accountId?: string,
  mode?: ArticleListMode,
) =>
  safeInvoke(
    "list_articles_by_tag",
    { response: ArticleDtoListSchema, args: listArticlesByTagArgs },
    { tagId, offset, limit, accountId, mode },
  );

export const getTagArticleCounts = (accountId?: string) =>
  safeInvoke(
    "get_tag_article_counts",
    {
      response: TagArticleCountsSchema,
      args: getTagArticleCountsArgs,
    },
    { accountId },
  );

export const copyToClipboard = (text: string) =>
  safeInvoke("copy_to_clipboard", { response: NullResponseSchema, args: copyToClipboardArgs }, { text });

export const addToReadingList = (url: string) =>
  safeInvoke("add_to_reading_list", { response: NullResponseSchema, args: addToReadingListArgs }, { url });

export const getPlatformInfo = () => safeInvoke("get_platform_info", { response: PlatformInfoSchema });
export const getDevRuntimeOptions = () => safeInvoke("get_dev_runtime_options", { response: DevRuntimeOptionsSchema });
export const getPlatformPermissionDeniedRecovery = () =>
  safeInvoke("get_platform_permission_denied_recovery", { response: PlatformPermissionDeniedRecoveryListSchema });

// Updater
export const checkForUpdate = () => safeInvoke("check_for_update", { response: UpdateInfoDtoSchema.nullable() });

export const downloadAndInstallUpdate = () =>
  safeInvoke("download_and_install_update", { response: NullResponseSchema });

export const restartApp = () => safeInvoke("restart_app", { response: NullResponseSchema });

// Database
export const getDatabaseInfo = () => safeInvoke("get_database_info", { response: DatabaseInfoDtoSchema });

export const vacuumDatabase = () => safeInvoke("vacuum_database", { response: DatabaseInfoDtoSchema });

// Logs
export const openLogDir = () => safeInvoke("open_log_dir", { response: NullResponseSchema });

export type { FeedArticleSummaryDto } from "@/api/schemas";
