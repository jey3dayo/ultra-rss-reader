import { Result } from "@praha/byethrow";
import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  type AccountDto,
  AccountDtoSchema,
  type AppError,
  AppErrorSchema,
  type ArticleDto,
  ArticleDtoSchema,
  addAccountArgs,
  addLocalFeedArgs,
  addToReadingListArgs,
  checkBrowserEmbedSupportArgs,
  copyToClipboardArgs,
  createFolderArgs,
  createTagArgs,
  type DiscoveredFeedDto,
  DiscoveredFeedDtoSchema,
  deleteAccountArgs,
  deleteFeedArgs,
  deleteTagArgs,
  discoverFeedsArgs,
  exportOpmlArgs,
  type FeedDto,
  FeedDtoSchema,
  type FolderDto,
  FolderDtoSchema,
  getArticleTagsArgs,
  listAccountArticlesArgs,
  listArticlesArgs,
  listArticlesByTagArgs,
  listFeedsArgs,
  listFoldersArgs,
  markArticleReadArgs,
  markArticlesReadArgs,
  markFeedReadArgs,
  markFolderReadArgs,
  openInBrowserArgs,
  renameAccountArgs,
  renameFeedArgs,
  renameTagArgs,
  searchArticlesArgs,
  setPreferenceArgs,
  type TagDto,
  TagDtoSchema,
  tagArticleArgs,
  toggleArticleStarArgs,
  type UpdateInfoDto,
  UpdateInfoDtoSchema,
  untagArticleArgs,
  updateAccountSyncArgs,
  updateFeedDisplayModeArgs,
  updateFeedFolderArgs,
} from "@/api/schemas";

// Re-export types so existing consumers don't break
export type { AccountDto, AppError, ArticleDto, DiscoveredFeedDto, FeedDto, FolderDto, TagDto, UpdateInfoDto };

// --- safeInvoke infrastructure ---

type InvokeSchemas<R extends z.ZodType = z.ZodType> = {
  response: R;
  args?: z.ZodType;
};

function isSchemas(v: unknown): v is InvokeSchemas {
  return (
    typeof v === "object" &&
    v !== null &&
    "response" in v &&
    typeof ((v as Record<string, unknown>).response as Record<string, unknown>)?.parse === "function"
  );
}

function toAppError(cmd: string, error: unknown): AppError {
  if (error instanceof Error && "issues" in error) {
    const zodErr = error as { issues: Array<{ path: (string | number)[]; message: string }> };
    const detail = zodErr.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    console.error(`[tauri-commands] ${cmd} validation failed:`, detail);
    return { type: "UserVisible", message: `Response validation failed: ${detail}` };
  }
  console.error(`[tauri-commands] ${cmd} failed:`, error);
  const result = AppErrorSchema.safeParse(error);
  return result.success ? result.data : { type: "UserVisible", message: String(error) };
}

// Overload: with schemas (recommended)
function safeInvoke<R extends z.ZodType>(
  cmd: string,
  schemas: InvokeSchemas<R>,
  args?: Record<string, unknown>,
): Result.ResultAsync<z.output<R>, AppError>;

// Overload: without schemas (backward compat)
function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Result.ResultAsync<T, AppError>;

// Implementation
function safeInvoke(
  cmd: string,
  schemasOrArgs?: InvokeSchemas | Record<string, unknown>,
  maybeArgs?: Record<string, unknown>,
): Result.ResultAsync<unknown, AppError> {
  const schemas = isSchemas(schemasOrArgs) ? schemasOrArgs : undefined;
  const args = isSchemas(schemasOrArgs) ? maybeArgs : schemasOrArgs;

  return Result.try({
    try: async () => {
      const validatedArgs = schemas?.args && args ? (schemas.args.parse(args) as Record<string, unknown>) : args;
      const raw = await invoke(cmd, validatedArgs);
      return schemas?.response ? schemas.response.parse(raw) : raw;
    },
    catch: (error) => toAppError(cmd, error),
  });
}

// --- Commands ---

export const listAccounts = () => safeInvoke("list_accounts", { response: z.array(AccountDtoSchema) });

export const listFolders = (accountId: string) =>
  safeInvoke("list_folders", { response: z.array(FolderDtoSchema), args: listFoldersArgs }, { accountId });

export const listFeeds = (accountId: string) =>
  safeInvoke("list_feeds", { response: z.array(FeedDtoSchema), args: listFeedsArgs }, { accountId });

export const listArticles = (feedId: string, offset?: number, limit?: number) =>
  safeInvoke(
    "list_articles",
    { response: z.array(ArticleDtoSchema), args: listArticlesArgs },
    { feedId, offset, limit },
  );

export const listAccountArticles = (accountId: string, offset?: number, limit?: number) =>
  safeInvoke(
    "list_account_articles",
    { response: z.array(ArticleDtoSchema), args: listAccountArticlesArgs },
    { accountId, offset, limit },
  );

export const markArticleRead = (articleId: string, read = true) =>
  safeInvoke("mark_article_read", { response: z.null(), args: markArticleReadArgs }, { articleId, read });

export const markArticlesRead = (articleIds: string[]) =>
  safeInvoke("mark_articles_read", { response: z.null(), args: markArticlesReadArgs }, { articleIds });

export const toggleArticleStar = (articleId: string, starred: boolean) =>
  safeInvoke("toggle_article_star", { response: z.null(), args: toggleArticleStarArgs }, { articleId, starred });

export const markFeedRead = (feedId: string) =>
  safeInvoke("mark_feed_read", { response: z.null(), args: markFeedReadArgs }, { feedId });

export const markFolderRead = (folderId: string) =>
  safeInvoke("mark_folder_read", { response: z.null(), args: markFolderReadArgs }, { folderId });

export const searchArticles = (accountId: string, query: string, offset?: number, limit?: number) =>
  safeInvoke(
    "search_articles",
    { response: z.array(ArticleDtoSchema), args: searchArticlesArgs },
    { accountId, query, offset, limit },
  );

export const addAccount = (kind: string, name: string, serverUrl?: string, username?: string, password?: string) =>
  safeInvoke(
    "add_account",
    { response: AccountDtoSchema, args: addAccountArgs },
    { kind, name, serverUrl, username, password },
  );

export const updateAccountSync = (
  accountId: string,
  syncIntervalSecs: number,
  syncOnWake: boolean,
  keepReadItemsDays: number,
) =>
  safeInvoke(
    "update_account_sync",
    { response: AccountDtoSchema, args: updateAccountSyncArgs },
    { accountId, syncIntervalSecs, syncOnWake, keepReadItemsDays },
  );

export const renameAccount = (accountId: string, name: string) =>
  safeInvoke("rename_account", { response: AccountDtoSchema, args: renameAccountArgs }, { accountId, name });

export const deleteAccount = (accountId: string) =>
  safeInvoke("delete_account", { response: z.null(), args: deleteAccountArgs }, { accountId });

export const discoverFeeds = (url: string) =>
  safeInvoke("discover_feeds", { response: z.array(DiscoveredFeedDtoSchema), args: discoverFeedsArgs }, { url });

export const addLocalFeed = (accountId: string, url: string) =>
  safeInvoke("add_local_feed", { response: FeedDtoSchema, args: addLocalFeedArgs }, { accountId, url });

export const createFolder = (accountId: string, name: string) =>
  safeInvoke("create_folder", { response: FolderDtoSchema, args: createFolderArgs }, { accountId, name });

export const deleteFeed = (feedId: string) =>
  safeInvoke("delete_feed", { response: z.null(), args: deleteFeedArgs }, { feedId });

export const renameFeed = (feedId: string, title: string) =>
  safeInvoke("rename_feed", { response: z.null(), args: renameFeedArgs }, { feedId, title });

export const updateFeedFolder = (feedId: string, folderId: string | null) =>
  safeInvoke("update_feed_folder", { response: z.null(), args: updateFeedFolderArgs }, { feedId, folderId });

export const updateFeedDisplayMode = (feedId: string, displayMode: string) =>
  safeInvoke(
    "update_feed_display_mode",
    { response: z.null(), args: updateFeedDisplayModeArgs },
    { feedId, displayMode },
  );

export const openInBrowser = (url: string, background?: boolean) =>
  safeInvoke("open_in_browser", { response: z.null(), args: openInBrowserArgs }, { url, background });

export const checkBrowserEmbedSupport = (url: string) =>
  safeInvoke("check_browser_embed_support", { response: z.boolean(), args: checkBrowserEmbedSupportArgs }, { url });

export const triggerSync = () => safeInvoke("trigger_sync", { response: z.boolean() });

export const exportOpml = (accountId: string) =>
  safeInvoke("export_opml", { response: z.string(), args: exportOpmlArgs }, { accountId });

export const getPreferences = () => safeInvoke("get_preferences", { response: z.record(z.string(), z.string()) });

export const setPreference = (key: string, value: string) =>
  safeInvoke("set_preference", { response: z.null(), args: setPreferenceArgs }, { key, value });

// Tags
export const listTags = () => safeInvoke("list_tags", { response: z.array(TagDtoSchema) });

export const createTag = (name: string, color?: string) =>
  safeInvoke("create_tag", { response: TagDtoSchema, args: createTagArgs }, { name, color });

export const renameTag = (tagId: string, name: string, color?: string | null) =>
  safeInvoke("rename_tag", { response: TagDtoSchema, args: renameTagArgs }, { tagId, name, color });

export const deleteTag = (tagId: string) =>
  safeInvoke("delete_tag", { response: z.null(), args: deleteTagArgs }, { tagId });

export const tagArticle = (articleId: string, tagId: string) =>
  safeInvoke("tag_article", { response: z.null(), args: tagArticleArgs }, { articleId, tagId });

export const untagArticle = (articleId: string, tagId: string) =>
  safeInvoke("untag_article", { response: z.null(), args: untagArticleArgs }, { articleId, tagId });

export const getArticleTags = (articleId: string) =>
  safeInvoke("get_article_tags", { response: z.array(TagDtoSchema), args: getArticleTagsArgs }, { articleId });

export const listArticlesByTag = (tagId: string, offset?: number, limit?: number) =>
  safeInvoke(
    "list_articles_by_tag",
    { response: z.array(ArticleDtoSchema), args: listArticlesByTagArgs },
    { tagId, offset, limit },
  );

export const getTagArticleCounts = () =>
  safeInvoke("get_tag_article_counts", { response: z.record(z.string(), z.number()) });

export const copyToClipboard = (text: string) =>
  safeInvoke("copy_to_clipboard", { response: z.null(), args: copyToClipboardArgs }, { text });

export const addToReadingList = (url: string) =>
  safeInvoke("add_to_reading_list", { response: z.null(), args: addToReadingListArgs }, { url });

// Updater
export const checkForUpdate = () => safeInvoke("check_for_update", { response: UpdateInfoDtoSchema.nullable() });

export const downloadAndInstallUpdate = () => safeInvoke("download_and_install_update", { response: z.null() });

export const restartApp = () => safeInvoke("restart_app", { response: z.null() });
