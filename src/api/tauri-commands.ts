import { Result } from "@praha/byethrow";
import { invoke } from "@tauri-apps/api/core";

// Error type from Rust backend
type AppError = { type: "UserVisible"; message: string } | { type: "Retryable"; message: string };

export type AccountDto = {
  id: string;
  kind: string;
  name: string;
  server_url: string | null;
  sync_interval_secs: number;
  sync_on_wake: boolean;
  keep_read_items_days: number;
};
export type FolderDto = { id: string; account_id: string; name: string; sort_order: number };
export type FeedDto = {
  id: string;
  account_id: string;
  folder_id: string | null;
  title: string;
  url: string;
  site_url: string;
  unread_count: number;
};
export type ArticleDto = {
  id: string;
  feed_id: string;
  title: string;
  content_sanitized: string;
  summary: string | null;
  url: string | null;
  author: string | null;
  published_at: string;
  thumbnail: string | null;
  is_read: boolean;
  is_starred: boolean;
};

export type TagDto = { id: string; name: string; color: string | null };
export type DiscoveredFeedDto = { url: string; title: string };

function toAppError(cmd: string, error: unknown): AppError {
  console.error(`[tauri-commands] ${cmd} failed:`, error);
  return typeof error === "object" && error !== null && "type" in error
    ? (error as AppError)
    : { type: "UserVisible", message: String(error) };
}

function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Result.ResultAsync<T, AppError> {
  return Result.try({
    try: () => invoke<T>(cmd, args),
    catch: (error) => toAppError(cmd, error),
  });
}

// Commands
export const listAccounts = () => safeInvoke<AccountDto[]>("list_accounts");
export const listFolders = (accountId: string) => safeInvoke<FolderDto[]>("list_folders", { accountId });
export const listFeeds = (accountId: string) => safeInvoke<FeedDto[]>("list_feeds", { accountId });
export const listArticles = (feedId: string, offset?: number, limit?: number) =>
  safeInvoke<ArticleDto[]>("list_articles", { feedId, offset, limit });
export const listAccountArticles = (accountId: string, offset?: number, limit?: number) =>
  safeInvoke<ArticleDto[]>("list_account_articles", { accountId, offset, limit });
export const markArticleRead = (articleId: string, read = true) =>
  safeInvoke<void>("mark_article_read", { articleId, read });
export const markArticlesRead = (articleIds: string[]) => safeInvoke<void>("mark_articles_read", { articleIds });
export const toggleArticleStar = (articleId: string, starred: boolean) =>
  safeInvoke<void>("toggle_article_star", { articleId, starred });
export const markFeedRead = (feedId: string) => safeInvoke<void>("mark_feed_read", { feedId });
export const markFolderRead = (folderId: string) => safeInvoke<void>("mark_folder_read", { folderId });
export const searchArticles = (accountId: string, query: string, offset?: number, limit?: number) =>
  safeInvoke<ArticleDto[]>("search_articles", { accountId, query, offset, limit });

export const addAccount = (kind: string, name: string, serverUrl?: string, username?: string, password?: string) =>
  safeInvoke<AccountDto>("add_account", { kind, name, serverUrl, username, password });

export const updateAccountSync = (
  accountId: string,
  syncIntervalSecs: number,
  syncOnWake: boolean,
  keepReadItemsDays: number,
) => safeInvoke<AccountDto>("update_account_sync", { accountId, syncIntervalSecs, syncOnWake, keepReadItemsDays });

export const renameAccount = (accountId: string, name: string) =>
  safeInvoke<AccountDto>("rename_account", { accountId, name });

export const deleteAccount = (accountId: string) => safeInvoke<void>("delete_account", { accountId });

export const discoverFeeds = (url: string) => safeInvoke<DiscoveredFeedDto[]>("discover_feeds", { url });

export const addLocalFeed = (accountId: string, url: string) =>
  safeInvoke<FeedDto>("add_local_feed", { accountId, url });

export const createFolder = (accountId: string, name: string) =>
  safeInvoke<FolderDto>("create_folder", { accountId, name });

export const deleteFeed = (feedId: string) => safeInvoke<void>("delete_feed", { feedId });
export const renameFeed = (feedId: string, title: string) => safeInvoke<void>("rename_feed", { feedId, title });

export const updateFeedFolder = (feedId: string, folderId: string | null) =>
  safeInvoke<void>("update_feed_folder", { feedId, folderId });

export const openInBrowser = (url: string) => safeInvoke<void>("open_in_browser", { url });

export const triggerSync = () => safeInvoke<boolean>("trigger_sync");

export const exportOpml = (accountId: string) => safeInvoke<string>("export_opml", { accountId });

export const getPreferences = () => safeInvoke<Record<string, string>>("get_preferences");
export const setPreference = (key: string, value: string) => safeInvoke<void>("set_preference", { key, value });

// Tags
export const listTags = () => safeInvoke<TagDto[]>("list_tags");
export const createTag = (name: string, color?: string) => safeInvoke<TagDto>("create_tag", { name, color });
export const renameTag = (tagId: string, name: string) => safeInvoke<TagDto>("rename_tag", { tagId, name });
export const deleteTag = (tagId: string) => safeInvoke<void>("delete_tag", { tagId });
export const tagArticle = (articleId: string, tagId: string) => safeInvoke<void>("tag_article", { articleId, tagId });
export const untagArticle = (articleId: string, tagId: string) =>
  safeInvoke<void>("untag_article", { articleId, tagId });
export const getArticleTags = (articleId: string) => safeInvoke<TagDto[]>("get_article_tags", { articleId });
export const listArticlesByTag = (tagId: string, offset?: number, limit?: number) =>
  safeInvoke<ArticleDto[]>("list_articles_by_tag", { tagId, offset, limit });
export const getTagArticleCounts = () => safeInvoke<Record<string, number>>("get_tag_article_counts");

export const copyToClipboard = (text: string) => safeInvoke<void>("copy_to_clipboard", { text });
export const addToReadingList = (url: string) => safeInvoke<void>("add_to_reading_list", { url });
