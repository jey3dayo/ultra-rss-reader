import { invoke } from "@tauri-apps/api/core";

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

export const listAccounts = () => invoke<AccountDto[]>("list_accounts");
export const listFeeds = (accountId: string) => invoke<FeedDto[]>("list_feeds", { accountId });
export const listArticles = (feedId: string, offset?: number, limit?: number) =>
  invoke<ArticleDto[]>("list_articles", { feedId, offset, limit });
export const markArticleRead = (articleId: string) => invoke<void>("mark_article_read", { articleId });
export const toggleArticleStar = (articleId: string, starred: boolean) =>
  invoke<void>("toggle_article_star", { articleId, starred });
export const searchArticles = (accountId: string, query: string, offset?: number, limit?: number) =>
  invoke<ArticleDto[]>("search_articles", { accountId, query, offset, limit });

export const addAccount = (kind: string, name: string, serverUrl?: string, username?: string) =>
  invoke<AccountDto>("add_account", { kind, name, serverUrl, username });

export const deleteAccount = (accountId: string) => invoke<void>("delete_account", { accountId });

export const addLocalFeed = (accountId: string, url: string) => invoke<FeedDto>("add_local_feed", { accountId, url });

export const openInBrowser = (url: string) => invoke<void>("open_in_browser", { url });

export const triggerSync = () => invoke<void>("trigger_sync");
