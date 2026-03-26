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
