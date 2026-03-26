import { invoke } from "@tauri-apps/api/core";
import type { Result } from "@praha/byethrow";

// Error type from Rust backend
export type AppError = { type: "UserVisible"; message: string } | { type: "Retryable"; message: string };

export type AccountDto = { id: string; kind: string; name: string };
export type FeedDto = { id: string; account_id: string; title: string; url: string; unread_count: number };
export type ArticleDto = {
  id: string;
  feed_id: string;
  title: string;
  content_sanitized: string;
  url: string | null;
  author: string | null;
  published_at: string;
  thumbnail: string | null;
  is_read: boolean;
  is_starred: boolean;
};

// Helper: wrap invoke to return Result
async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<Result.Result<T, AppError>> {
  try {
    const data = await invoke<T>(cmd, args);
    return { type: "Success", value: data };
  } catch (error: unknown) {
    const appError: AppError =
      typeof error === "object" && error !== null && "type" in error
        ? (error as AppError)
        : { type: "UserVisible", message: String(error) };
    return { type: "Failure", error: appError };
  }
}

// Commands
export const listAccounts = () => safeInvoke<AccountDto[]>("list_accounts");
export const listFeeds = (accountId: string) => safeInvoke<FeedDto[]>("list_feeds", { accountId });
export const listArticles = (feedId: string, offset?: number, limit?: number) =>
  safeInvoke<ArticleDto[]>("list_articles", { feedId, offset, limit });
export const markArticleRead = (articleId: string) => safeInvoke<void>("mark_article_read", { articleId });
export const toggleArticleStar = (articleId: string, starred: boolean) =>
  safeInvoke<void>("toggle_article_star", { articleId, starred });
export const searchArticles = (accountId: string, query: string, offset?: number, limit?: number) =>
  safeInvoke<ArticleDto[]>("search_articles", { accountId, query, offset, limit });

export const addAccount = (kind: string, name: string, serverUrl?: string, username?: string) =>
  safeInvoke<AccountDto>("add_account", { kind, name, serverUrl, username });

export const deleteAccount = (accountId: string) => safeInvoke<void>("delete_account", { accountId });

export const addLocalFeed = (accountId: string, url: string) =>
  safeInvoke<FeedDto>("add_local_feed", { accountId, url });

export const openInBrowser = (url: string) => safeInvoke<void>("open_in_browser", { url });

export const triggerSync = () => safeInvoke<void>("trigger_sync");
