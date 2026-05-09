/**
 * Development mock for running outside Tauri (browser-only mode).
 * Automatically injects mockIPC when window.__TAURI_INTERNALS__ is not available.
 */

import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { z } from "zod";
import { commandArgsSchemas } from "@/api/schemas";
import type {
  AccountDto,
  AccountSyncStatusDto,
  ArticleDto,
  FeedDto,
  FolderDto,
  MuteKeywordDto,
  TagDto,
} from "@/api/tauri-commands";
import { DEFAULT_PLATFORM_INFO } from "@/constants/platform";
import { readDevIntent, readDevWebUrl, readDevWindowSize } from "@/dev/intent";
import {
  mockAccounts,
  mockArticles,
  mockArticleTags,
  mockFeeds,
  mockFolders,
  mockTags,
  resetMockDataForDevMocks,
} from "@/dev/mock-data";
import { addHours, getCurrentDate, getCurrentIsoTimestamp, toIsoTimestamp } from "@/lib/datetime";

export const DEV_MOCK_PLATFORM_INFO = DEFAULT_PLATFORM_INFO;

type MockCommandArgsSchema = z.ZodType<Record<string, unknown>>;
const browserMockCommandArgsSchemas = commandArgsSchemas satisfies Record<string, MockCommandArgsSchema>;
type BrowserMockCommandArgsSchemas = typeof browserMockCommandArgsSchemas;
type MockCommandWithArgs = keyof BrowserMockCommandArgsSchemas;

function parseMockArgs<TSchema extends MockCommandArgsSchema>(
  _command: MockCommandWithArgs,
  schema: TSchema,
  rawPayload: unknown,
): z.output<TSchema> {
  return schema.parse(rawPayload);
}

let nextAccountId = 100;
let nextFeedId = 100;
let nextFolderId = 100;
let nextTagId = 100;
let nextMuteKeywordId = 100;
const mockPreferences = new Map<string, string>();
const mockMuteKeywords: MuteKeywordDto[] = [];
const mockArticleViewHistory: {
  accountId: string;
  articleId: string;
  viewedAt: string;
}[] = [];
const initialMockArticleViewHistory: typeof mockArticleViewHistory = [
  {
    accountId: "acc-freshrss",
    articleId: "art-2",
    viewedAt: "2026-04-20T10:00:00Z",
  },
  {
    accountId: "acc-freshrss",
    articleId: "art-1",
    viewedAt: "2026-04-20T09:30:00Z",
  },
];

function resetDevMockState() {
  nextAccountId = 100;
  nextFeedId = 100;
  nextFolderId = 100;
  nextTagId = 100;
  nextMuteKeywordId = 100;
  mockPreferences.clear();
  mockMuteKeywords.splice(0);
  mockArticleViewHistory.splice(
    0,
    mockArticleViewHistory.length,
    ...initialMockArticleViewHistory.map((item) => structuredClone(item)),
  );
  resetMockDataForDevMocks();
}

function titleFromUrl(feedUrl: string): string {
  try {
    return new URL(feedUrl).hostname.replace(/^www\./, "");
  } catch {
    return feedUrl;
  }
}

function recalcUnread(feedId: string) {
  const feed = mockFeeds.find((f) => f.id === feedId);
  if (feed) {
    feed.unread_count = mockArticles.filter((a) => a.feed_id === feedId && !a.is_read).length;
  }
}

function countUnreadByAccount(accountId: string) {
  const feedIds = new Set(mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id));
  return mockArticles.filter((article) => feedIds.has(article.feed_id) && !article.is_read).length;
}

function countStarredByAccount(accountId: string) {
  const feedIds = new Set(mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id));
  return mockArticles.filter((article) => feedIds.has(article.feed_id) && article.is_starred).length;
}

function resolveOldUnreadFeedIds(scopeKind: "account" | "feed" | "folder", targetId: string) {
  if (scopeKind === "account") {
    return mockFeeds.filter((feed) => feed.account_id === targetId).map((feed) => feed.id);
  }
  if (scopeKind === "folder") {
    return mockFeeds.filter((feed) => feed.folder_id === targetId).map((feed) => feed.id);
  }
  return [targetId];
}

function findOldUnreadArticles(scopeKind: "account" | "feed" | "folder", targetId: string, olderThanDays: 7 | 30 | 90) {
  const feedIds = new Set(resolveOldUnreadFeedIds(scopeKind, targetId));
  const threshold = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  return mockArticles.filter((article) => {
    const publishedAt = Date.parse(article.published_at);
    return feedIds.has(article.feed_id) && !article.is_read && Number.isFinite(publishedAt) && publishedAt < threshold;
  });
}

function applyMuteKeywordFilter<
  T extends {
    title: string;
    content_sanitized: string;
    summary: string | null;
  },
>(articles: T[]) {
  if (mockMuteKeywords.length === 0) {
    return articles;
  }

  const normalize = (value: string) => value.trim().toLowerCase();

  return articles.filter((article) => {
    const title = normalize(article.title);
    const body = normalize(article.content_sanitized || article.summary || "");

    return !mockMuteKeywords.some((rule) => {
      const keyword = normalize(rule.keyword);
      if (!keyword) {
        return false;
      }
      if (rule.scope === "title") {
        return title.includes(keyword);
      }
      if (rule.scope === "body") {
        return body.includes(keyword);
      }
      return title.includes(keyword) || body.includes(keyword);
    });
  });
}

export function setupDevMocks() {
  if (window.__TAURI_INTERNALS__ && !window.__DEV_BROWSER_MOCKS__) return;
  resetDevMockState();
  window.__DEV_BROWSER_MOCKS__ = true;
  window.__ULTRA_RSS_BROWSER_MOCKS__ = true;

  const feedIntegrityReport = { orphaned_article_count: 0, orphaned_feeds: [] };

  console.info("[dev-mocks] Tauri not detected, injecting mock IPC with rich data for browser debugging");

  mockWindows("main");
  mockIPC(async (cmd, rawPayload) => {
    switch (cmd) {
      case "list_accounts":
        return mockAccounts;

      case "add_account": {
        const { kind, name, serverUrl } = parseMockArgs(
          "add_account",
          browserMockCommandArgsSchemas.add_account,
          rawPayload,
        );
        const account: AccountDto = {
          id: `dev-acc-${nextAccountId++}`,
          kind,
          name,
          username: null,
          server_url: serverUrl ?? null,
          sync_interval_secs: 3600,
          sync_on_startup: true,
          sync_on_wake: false,
          keep_read_items_days: 30,
        };
        mockAccounts.push(account);
        return account;
      }

      case "update_account_sync": {
        const { accountId, syncIntervalSecs, syncOnStartup, syncOnWake, keepReadItemsDays } = parseMockArgs(
          "update_account_sync",
          browserMockCommandArgsSchemas.update_account_sync,
          rawPayload,
        );
        const target = mockAccounts.find((a) => a.id === accountId);
        if (target) {
          target.sync_interval_secs = syncIntervalSecs;
          target.sync_on_startup = syncOnStartup;
          target.sync_on_wake = syncOnWake;
          target.keep_read_items_days = keepReadItemsDays;
        }
        return target ?? null;
      }

      case "update_account_credentials": {
        const { accountId, serverUrl, username } = parseMockArgs(
          "update_account_credentials",
          browserMockCommandArgsSchemas.update_account_credentials,
          rawPayload,
        );
        const target = mockAccounts.find((a) => a.id === accountId);
        if (target) {
          target.server_url = serverUrl ?? target.server_url;
          target.username = username ?? target.username;
        }
        return target ?? null;
      }

      case "rename_account": {
        const { accountId, name } = parseMockArgs(
          "rename_account",
          browserMockCommandArgsSchemas.rename_account,
          rawPayload,
        );
        const target = mockAccounts.find((a) => a.id === accountId);
        if (target) {
          target.name = name;
        }
        return target ?? null;
      }

      case "test_account_connection": {
        const { accountId } = parseMockArgs(
          "test_account_connection",
          browserMockCommandArgsSchemas.test_account_connection,
          rawPayload,
        );
        return mockAccounts.find((account) => account.id === accountId) ?? mockAccounts[0] ?? null;
      }

      case "delete_account": {
        const { accountId } = parseMockArgs("delete_account", browserMockCommandArgsSchemas.delete_account, rawPayload);
        const idx = mockAccounts.findIndex((a) => a.id === accountId);
        if (idx >= 0) mockAccounts.splice(idx, 1);
        const removedFeedIds = new Set(
          mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id),
        );
        const removedArticleIds = new Set(
          mockArticles.filter((article) => removedFeedIds.has(article.feed_id)).map((article) => article.id),
        );
        for (let i = mockFolders.length - 1; i >= 0; i -= 1) {
          if (mockFolders[i]?.account_id === accountId) {
            mockFolders.splice(i, 1);
          }
        }
        for (let i = mockFeeds.length - 1; i >= 0; i -= 1) {
          if (mockFeeds[i]?.account_id === accountId) {
            mockFeeds.splice(i, 1);
          }
        }
        for (let i = mockArticles.length - 1; i >= 0; i -= 1) {
          if (removedFeedIds.has(mockArticles[i]?.feed_id ?? "")) {
            mockArticles.splice(i, 1);
          }
        }
        for (let i = mockArticleTags.length - 1; i >= 0; i -= 1) {
          if (removedArticleIds.has(mockArticleTags[i]?.article_id ?? "")) {
            mockArticleTags.splice(i, 1);
          }
        }
        for (let i = mockArticleViewHistory.length - 1; i >= 0; i -= 1) {
          if (mockArticleViewHistory[i]?.accountId === accountId) {
            mockArticleViewHistory.splice(i, 1);
          }
        }
        return null;
      }

      case "get_account_sync_status":
        parseMockArgs("get_account_sync_status", browserMockCommandArgsSchemas.get_account_sync_status, rawPayload);
        return {
          last_success_at: null,
          last_error: null,
          error_count: 0,
          next_retry_at: null,
        } satisfies AccountSyncStatusDto;

      case "list_folders": {
        const { accountId } = parseMockArgs("list_folders", browserMockCommandArgsSchemas.list_folders, rawPayload);
        return mockFolders.filter((f) => f.account_id === accountId);
      }

      case "create_folder": {
        const { accountId, name } = parseMockArgs(
          "create_folder",
          browserMockCommandArgsSchemas.create_folder,
          rawPayload,
        );
        const folder: FolderDto = {
          id: `dev-folder-${nextFolderId++}`,
          account_id: accountId,
          name,
          sort_order: mockFolders.filter((f) => f.account_id === accountId).length,
        };
        mockFolders.push(folder);
        return folder;
      }

      case "list_feeds": {
        const { accountId } = parseMockArgs("list_feeds", browserMockCommandArgsSchemas.list_feeds, rawPayload);
        return mockFeeds.filter((f) => f.account_id === accountId);
      }

      case "add_local_feed": {
        const { accountId, url } = parseMockArgs(
          "add_local_feed",
          browserMockCommandArgsSchemas.add_local_feed,
          rawPayload,
        );
        const feedId = `dev-feed-${nextFeedId++}`;
        const feed: FeedDto = {
          id: feedId,
          account_id: accountId,
          folder_id: null,
          remote_id: null,
          title: titleFromUrl(url),
          url,
          site_url: url,
          unread_count: 3,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
        };
        mockFeeds.push(feed);
        // Generate sample articles for the new feed
        const now = getCurrentDate();
        for (let i = 0; i < 3; i++) {
          mockArticles.push({
            id: `${feedId}-art-${i}`,
            feed_id: feedId,
            title: `Sample article ${i + 1} from ${url}`,
            content_sanitized: `<p>This is a sample article fetched from ${url}.</p>`,
            summary: `Sample summary for article ${i + 1}`,
            url: `${url}#article-${i}`,
            author: null,
            published_at: toIsoTimestamp(addHours(now, -i)),
            thumbnail: null,
            is_read: false,
            is_starred: false,
          });
        }
        return feed;
      }

      case "list_articles": {
        const {
          feedId,
          unreadOnly = false,
          starredOnly = false,
          offset = 0,
          limit = 50,
        } = parseMockArgs("list_articles", browserMockCommandArgsSchemas.list_articles, rawPayload);
        const articles = mockArticles.filter(
          (article) =>
            article.feed_id === feedId && (!unreadOnly || !article.is_read) && (!starredOnly || article.is_starred),
        );
        return applyMuteKeywordFilter(articles).slice(offset, offset + limit);
      }

      case "list_account_articles": {
        const {
          accountId,
          unreadOnly = false,
          offset = 0,
          limit = 50,
        } = parseMockArgs("list_account_articles", browserMockCommandArgsSchemas.list_account_articles, rawPayload);
        const feedIds = new Set(mockFeeds.filter((f) => f.account_id === accountId).map((f) => f.id));
        const articles = mockArticles.filter((a) => feedIds.has(a.feed_id) && (!unreadOnly || !a.is_read));
        return applyMuteKeywordFilter(articles).slice(offset, offset + limit);
      }

      case "list_feed_article_summaries": {
        const { accountId } = parseMockArgs(
          "list_feed_article_summaries",
          browserMockCommandArgsSchemas.list_feed_article_summaries,
          rawPayload,
        );
        const visibleArticles = applyMuteKeywordFilter(mockArticles);
        return mockFeeds
          .filter((feed) => feed.account_id === accountId)
          .map((feed) => {
            const feedArticles = visibleArticles.filter((article) => article.feed_id === feed.id);
            let latestArticleAt: string | null = null;
            let latestArticleTime = Number.NEGATIVE_INFINITY;

            for (const article of feedArticles) {
              const publishedTime = Date.parse(article.published_at);
              if (!Number.isNaN(publishedTime) && publishedTime > latestArticleTime) {
                latestArticleAt = article.published_at;
                latestArticleTime = publishedTime;
              }
            }

            return {
              feed_id: feed.id,
              latest_article_at: latestArticleAt,
              starred_count: feedArticles.filter((article) => article.is_starred).length,
            };
          });
      }

      case "list_folder_articles": {
        const {
          folderId,
          mode = "all",
          offset = 0,
          limit = 50,
        } = parseMockArgs("list_folder_articles", browserMockCommandArgsSchemas.list_folder_articles, rawPayload);
        const feedIds = new Set(mockFeeds.filter((feed) => feed.folder_id === folderId).map((feed) => feed.id));
        const articles = mockArticles.filter((article) => {
          if (!feedIds.has(article.feed_id)) {
            return false;
          }
          if (mode === "unread") {
            return !article.is_read;
          }
          if (mode === "starred") {
            return article.is_starred;
          }
          return true;
        });
        return applyMuteKeywordFilter(articles).slice(offset, offset + limit);
      }

      case "count_account_unread_articles": {
        const { accountId } = parseMockArgs(
          "count_account_unread_articles",
          browserMockCommandArgsSchemas.count_account_unread_articles,
          rawPayload,
        );
        return countUnreadByAccount(accountId);
      }

      case "count_account_starred_articles": {
        const { accountId } = parseMockArgs(
          "count_account_starred_articles",
          browserMockCommandArgsSchemas.count_account_starred_articles,
          rawPayload,
        );
        return countStarredByAccount(accountId);
      }

      case "mark_account_read": {
        const { accountId } = parseMockArgs(
          "mark_account_read",
          browserMockCommandArgsSchemas.mark_account_read,
          rawPayload,
        );
        const feedIds = new Set(mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id));
        for (const article of mockArticles) {
          if (feedIds.has(article.feed_id)) {
            article.is_read = true;
          }
        }
        for (const feedId of feedIds) recalcUnread(feedId);
        return null;
      }

      case "mark_account_starred_read": {
        const { accountId } = parseMockArgs(
          "mark_account_starred_read",
          browserMockCommandArgsSchemas.mark_account_starred_read,
          rawPayload,
        );
        const feedIds = new Set(mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id));
        const affectedFeedIds = new Set<string>();
        for (const article of mockArticles) {
          if (feedIds.has(article.feed_id) && article.is_starred) {
            article.is_read = true;
            affectedFeedIds.add(article.feed_id);
          }
        }
        for (const feedId of affectedFeedIds) recalcUnread(feedId);
        return null;
      }

      case "count_old_unread_articles": {
        const { scopeKind, targetId, olderThanDays } = parseMockArgs(
          "count_old_unread_articles",
          browserMockCommandArgsSchemas.count_old_unread_articles,
          rawPayload,
        );
        return findOldUnreadArticles(scopeKind, targetId, olderThanDays).length;
      }

      case "mark_old_unread_read": {
        const { scopeKind, targetId, olderThanDays } = parseMockArgs(
          "mark_old_unread_read",
          browserMockCommandArgsSchemas.mark_old_unread_read,
          rawPayload,
        );
        const affectedFeedIds = new Set<string>();
        for (const article of findOldUnreadArticles(scopeKind, targetId, olderThanDays)) {
          article.is_read = true;
          affectedFeedIds.add(article.feed_id);
        }
        for (const feedId of affectedFeedIds) recalcUnread(feedId);
        return null;
      }

      case "unstar_account_articles": {
        const { accountId } = parseMockArgs(
          "unstar_account_articles",
          browserMockCommandArgsSchemas.unstar_account_articles,
          rawPayload,
        );
        const feedIds = new Set(mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id));
        for (const article of mockArticles) {
          if (feedIds.has(article.feed_id)) {
            article.is_starred = false;
          }
        }
        return null;
      }

      case "list_starred_articles": {
        const { accountId } = parseMockArgs(
          "list_starred_articles",
          browserMockCommandArgsSchemas.list_starred_articles,
          rawPayload,
        );
        const feedIds = new Set(mockFeeds.filter((f) => f.account_id === accountId).map((f) => f.id));
        return applyMuteKeywordFilter(mockArticles.filter((a) => feedIds.has(a.feed_id) && a.is_starred));
      }

      case "list_recent_articles": {
        const {
          accountId,
          mode = "all",
          offset = 0,
          limit = 20,
        } = parseMockArgs("list_recent_articles", browserMockCommandArgsSchemas.list_recent_articles, rawPayload);
        const feedIds = new Set(mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id));
        const articleById = new Map(mockArticles.map((article) => [article.id, article]));
        const articles = mockArticleViewHistory
          .filter((item) => item.accountId === accountId)
          .map((item): ArticleDto | null => {
            const article = articleById.get(item.articleId);
            if (!article || !feedIds.has(article.feed_id)) {
              return null;
            }
            return { ...article, viewed_at: item.viewedAt };
          })
          .filter((article): article is ArticleDto => article !== null)
          .filter((article) => {
            if (mode === "unread") {
              return !article.is_read;
            }
            if (mode === "starred") {
              return article.is_starred;
            }
            return true;
          });
        return applyMuteKeywordFilter(articles).slice(offset, offset + limit);
      }

      case "get_feed_integrity_report":
        return feedIntegrityReport;

      case "cleanup_feed_integrity_orphans": {
        const { dryRun } = parseMockArgs(
          "cleanup_feed_integrity_orphans",
          browserMockCommandArgsSchemas.cleanup_feed_integrity_orphans,
          rawPayload,
        );
        return {
          dry_run: dryRun,
          orphaned_article_count: feedIntegrityReport.orphaned_article_count,
          deleted_article_count: dryRun ? 0 : feedIntegrityReport.orphaned_article_count,
        };
      }

      case "search_articles": {
        const {
          accountId,
          query,
          offset = 0,
          limit = 50,
        } = parseMockArgs("search_articles", browserMockCommandArgsSchemas.search_articles, rawPayload);
        const feedIds = new Set(mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id));
        const normalizedQuery = query.toLowerCase();
        const articles = mockArticles.filter(
          (article) => feedIds.has(article.feed_id) && article.title.toLowerCase().includes(normalizedQuery),
        );
        return applyMuteKeywordFilter(articles).slice(offset, offset + limit);
      }

      case "list_mute_keywords":
        return [...mockMuteKeywords].sort((a, b) => b.created_at.localeCompare(a.created_at));

      case "create_mute_keyword": {
        const { keyword, scope } = parseMockArgs(
          "create_mute_keyword",
          browserMockCommandArgsSchemas.create_mute_keyword,
          rawPayload,
        );
        const normalizedKeyword = keyword.trim().toLowerCase();
        const exists = mockMuteKeywords.some(
          (rule) => rule.keyword.trim().toLowerCase() === normalizedKeyword && rule.scope === scope,
        );
        if (exists) {
          throw { type: "UserVisible", message: "Mute keyword already exists" };
        }

        const now = getCurrentIsoTimestamp();
        const rule: MuteKeywordDto = {
          id: `dev-mute-${nextMuteKeywordId++}`,
          keyword: keyword.trim(),
          scope,
          created_at: now,
          updated_at: now,
        };
        mockMuteKeywords.unshift(rule);
        return rule;
      }

      case "update_mute_keyword": {
        const { muteKeywordId, scope } = parseMockArgs(
          "update_mute_keyword",
          browserMockCommandArgsSchemas.update_mute_keyword,
          rawPayload,
        );
        const rule = mockMuteKeywords.find((candidate) => candidate.id === muteKeywordId);
        if (!rule) {
          throw { type: "UserVisible", message: "Mute keyword not found" };
        }
        const duplicate = mockMuteKeywords.some(
          (candidate) =>
            candidate.id !== muteKeywordId &&
            candidate.keyword.trim().toLowerCase() === rule.keyword.trim().toLowerCase() &&
            candidate.scope === scope,
        );
        if (duplicate) {
          throw { type: "UserVisible", message: "Mute keyword already exists" };
        }
        rule.scope = scope;
        rule.updated_at = getCurrentIsoTimestamp();
        return rule;
      }

      case "delete_mute_keyword": {
        const { muteKeywordId } = parseMockArgs(
          "delete_mute_keyword",
          browserMockCommandArgsSchemas.delete_mute_keyword,
          rawPayload,
        );
        const index = mockMuteKeywords.findIndex((rule) => rule.id === muteKeywordId);
        if (index >= 0) {
          mockMuteKeywords.splice(index, 1);
        }
        return null;
      }

      case "mark_article_read": {
        const { articleId, read } = parseMockArgs(
          "mark_article_read",
          browserMockCommandArgsSchemas.mark_article_read,
          rawPayload,
        );
        const art = mockArticles.find((a) => a.id === articleId);
        if (art) {
          art.is_read = read ?? true;
          recalcUnread(art.feed_id);
        }
        return null;
      }

      case "record_article_view": {
        const { accountId, articleId } = parseMockArgs(
          "record_article_view",
          browserMockCommandArgsSchemas.record_article_view,
          rawPayload,
        );
        const feedIds = new Set(mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id));
        const article = mockArticles.find((candidate) => candidate.id === articleId);
        if (!article || !feedIds.has(article.feed_id)) {
          return null;
        }
        const existingIndex = mockArticleViewHistory.findIndex(
          (item) => item.accountId === accountId && item.articleId === articleId,
        );
        if (existingIndex >= 0) {
          mockArticleViewHistory.splice(existingIndex, 1);
        }
        mockArticleViewHistory.unshift({
          accountId,
          articleId,
          viewedAt: getCurrentIsoTimestamp(),
        });
        mockArticleViewHistory.splice(20);
        return null;
      }

      case "clear_article_view_history": {
        const { accountId } = parseMockArgs(
          "clear_article_view_history",
          browserMockCommandArgsSchemas.clear_article_view_history,
          rawPayload,
        );
        let removed = 0;
        for (let index = mockArticleViewHistory.length - 1; index >= 0; index--) {
          if (mockArticleViewHistory[index].accountId === accountId) {
            mockArticleViewHistory.splice(index, 1);
            removed++;
          }
        }
        return removed;
      }

      case "mark_articles_read": {
        const { articleIds } = parseMockArgs(
          "mark_articles_read",
          browserMockCommandArgsSchemas.mark_articles_read,
          rawPayload,
        );
        const affectedFeedIds = new Set<string>();
        const articleById = new Map(mockArticles.map((article) => [article.id, article]));
        for (const id of articleIds) {
          const art = articleById.get(id);
          if (art) {
            art.is_read = true;
            affectedFeedIds.add(art.feed_id);
          }
        }
        for (const fid of affectedFeedIds) recalcUnread(fid);
        return null;
      }

      case "mark_feed_read": {
        const { feedId } = parseMockArgs("mark_feed_read", browserMockCommandArgsSchemas.mark_feed_read, rawPayload);
        for (const art of mockArticles) {
          if (art.feed_id === feedId) art.is_read = true;
        }
        recalcUnread(feedId);
        return null;
      }

      case "mark_folder_read": {
        const { folderId } = parseMockArgs(
          "mark_folder_read",
          browserMockCommandArgsSchemas.mark_folder_read,
          rawPayload,
        );
        const folderFeedIds = new Set(mockFeeds.filter((f) => f.folder_id === folderId).map((f) => f.id));
        for (const art of mockArticles) {
          if (folderFeedIds.has(art.feed_id)) art.is_read = true;
        }
        for (const fid of folderFeedIds) recalcUnread(fid);
        return null;
      }

      case "toggle_article_star": {
        const { articleId, starred } = parseMockArgs(
          "toggle_article_star",
          browserMockCommandArgsSchemas.toggle_article_star,
          rawPayload,
        );
        const art = mockArticles.find((a) => a.id === articleId);
        if (art) art.is_starred = starred;
        return null;
      }

      case "get_preferences":
        return Object.fromEntries(mockPreferences);

      case "set_preference": {
        const { key, value } = parseMockArgs(
          "set_preference",
          browserMockCommandArgsSchemas.set_preference,
          rawPayload,
        );
        mockPreferences.set(key, value);
        return null;
      }

      case "set_mute_auto_mark_read": {
        const { enabled } = parseMockArgs(
          "set_mute_auto_mark_read",
          browserMockCommandArgsSchemas.set_mute_auto_mark_read,
          rawPayload,
        );
        mockPreferences.set("mute_auto_mark_read", String(enabled));
        return null;
      }

      case "get_platform_info":
        return DEV_MOCK_PLATFORM_INFO;

      case "get_dev_runtime_options": {
        const devWindowSize = readDevWindowSize();
        return {
          dev_intent: readDevIntent(),
          dev_web_url: readDevWebUrl(),
          dev_window_width: devWindowSize?.width ?? null,
          dev_window_height: devWindowSize?.height ?? null,
        };
      }

      case "export_opml":
        parseMockArgs("export_opml", browserMockCommandArgsSchemas.export_opml, rawPayload);
        return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head><title>Mock Export</title></head>
  <body>
    <outline text="Tech" title="Tech">
      <outline text="Ars Technica" title="Ars Technica" type="rss" xmlUrl="https://feeds.arstechnica.com/arstechnica/index" htmlUrl="https://arstechnica.com"/>
    </outline>
    <outline text="Standalone" title="Standalone" type="rss" xmlUrl="https://example.com/feed.xml"/>
  </body>
</opml>`;

      case "list_tags":
        return mockTags;

      case "create_tag": {
        const { name, color } = parseMockArgs("create_tag", browserMockCommandArgsSchemas.create_tag, rawPayload);
        const tag: TagDto = {
          id: `dev-tag-${nextTagId++}`,
          name,
          color: color ?? null,
        };
        mockTags.push(tag);
        return tag;
      }

      case "rename_tag": {
        const { tagId, name, color } = parseMockArgs(
          "rename_tag",
          browserMockCommandArgsSchemas.rename_tag,
          rawPayload,
        );
        const renameIdx = mockTags.findIndex((t) => t.id === tagId);
        if (renameIdx >= 0) {
          mockTags[renameIdx].name = name;
          mockTags[renameIdx].color = color ?? null;
          return mockTags[renameIdx];
        }
        throw { type: "UserVisible", message: "Tag not found" };
      }

      case "delete_tag": {
        const { tagId } = parseMockArgs("delete_tag", browserMockCommandArgsSchemas.delete_tag, rawPayload);
        const tagIdx = mockTags.findIndex((t) => t.id === tagId);
        if (tagIdx >= 0) mockTags.splice(tagIdx, 1);
        // Remove associated article_tags
        for (let i = mockArticleTags.length - 1; i >= 0; i--) {
          if (mockArticleTags[i].tag_id === tagId) mockArticleTags.splice(i, 1);
        }
        return null;
      }

      case "tag_article": {
        const { articleId, tagId } = parseMockArgs(
          "tag_article",
          browserMockCommandArgsSchemas.tag_article,
          rawPayload,
        );
        const exists = mockArticleTags.some((at) => at.article_id === articleId && at.tag_id === tagId);
        if (!exists) {
          mockArticleTags.push({
            article_id: articleId,
            tag_id: tagId,
          });
        }
        return null;
      }

      case "untag_article": {
        const { articleId, tagId } = parseMockArgs(
          "untag_article",
          browserMockCommandArgsSchemas.untag_article,
          rawPayload,
        );
        const atIdx = mockArticleTags.findIndex((at) => at.article_id === articleId && at.tag_id === tagId);
        if (atIdx >= 0) mockArticleTags.splice(atIdx, 1);
        return null;
      }

      case "get_article_tags": {
        const { articleId } = parseMockArgs(
          "get_article_tags",
          browserMockCommandArgsSchemas.get_article_tags,
          rawPayload,
        );
        const tagIds = new Set(mockArticleTags.filter((at) => at.article_id === articleId).map((at) => at.tag_id));
        return mockTags.filter((t) => tagIds.has(t.id));
      }

      case "list_articles_by_tag": {
        const {
          tagId,
          accountId,
          mode = "all",
          offset = 0,
          limit = 50,
        } = parseMockArgs("list_articles_by_tag", browserMockCommandArgsSchemas.list_articles_by_tag, rawPayload);
        const articleIds = new Set(mockArticleTags.filter((at) => at.tag_id === tagId).map((at) => at.article_id));
        let filtered = mockArticles.filter((a) => articleIds.has(a.id));
        if (accountId) {
          const feedIds = new Set(mockFeeds.filter((f) => f.account_id === accountId).map((f) => f.id));
          filtered = filtered.filter((a) => feedIds.has(a.feed_id));
        }
        if (mode === "unread") {
          filtered = filtered.filter((article) => !article.is_read);
        } else if (mode === "starred") {
          filtered = filtered.filter((article) => article.is_starred);
        }
        return applyMuteKeywordFilter(filtered).slice(offset, offset + limit);
      }

      case "get_tag_article_counts": {
        const { accountId } = parseMockArgs(
          "get_tag_article_counts",
          browserMockCommandArgsSchemas.get_tag_article_counts,
          rawPayload,
        );
        const counts: Record<string, number> = {};
        const articleById = new Map(mockArticles.map((article) => [article.id, article]));
        const feedById = new Map(mockFeeds.map((feed) => [feed.id, feed]));
        for (const at of mockArticleTags) {
          if (accountId) {
            const article = articleById.get(at.article_id);
            if (!article) continue;
            const feed = feedById.get(article.feed_id);
            if (!feed || feed.account_id !== accountId) continue;
          }
          counts[at.tag_id] = (counts[at.tag_id] ?? 0) + 1;
        }
        return counts;
      }

      case "check_browser_embed_support": {
        const { url } = parseMockArgs(
          "check_browser_embed_support",
          browserMockCommandArgsSchemas.check_browser_embed_support,
          rawPayload,
        );
        try {
          const host = new URL(url).hostname;
          return !host.endsWith("note.com");
        } catch {
          return true;
        }
      }

      case "create_or_update_browser_webview": {
        const { url } = parseMockArgs(
          "create_or_update_browser_webview",
          browserMockCommandArgsSchemas.create_or_update_browser_webview,
          rawPayload,
        );
        return {
          url,
          can_go_back: false,
          can_go_forward: false,
          is_loading: false,
        };
      }

      case "set_browser_webview_bounds":
        parseMockArgs(
          "set_browser_webview_bounds",
          browserMockCommandArgsSchemas.set_browser_webview_bounds,
          rawPayload,
        );
        return null;

      case "focus_browser_webview":
        return null;

      case "delete_feed": {
        const { feedId } = parseMockArgs("delete_feed", browserMockCommandArgsSchemas.delete_feed, rawPayload);
        const feedIdx = mockFeeds.findIndex((f) => f.id === feedId);
        if (feedIdx >= 0) {
          const removed = mockFeeds.splice(feedIdx, 1)[0];
          const removedArticleIds = new Set(
            mockArticles.filter((article) => article.feed_id === removed.id).map((article) => article.id),
          );
          // Remove associated articles
          for (let i = mockArticles.length - 1; i >= 0; i--) {
            if (mockArticles[i].feed_id === removed.id) mockArticles.splice(i, 1);
          }
          for (let i = mockArticleTags.length - 1; i >= 0; i -= 1) {
            if (removedArticleIds.has(mockArticleTags[i]?.article_id ?? "")) {
              mockArticleTags.splice(i, 1);
            }
          }
          for (let i = mockArticleViewHistory.length - 1; i >= 0; i -= 1) {
            if (removedArticleIds.has(mockArticleViewHistory[i]?.articleId ?? "")) {
              mockArticleViewHistory.splice(i, 1);
            }
          }
        }
        return null;
      }

      case "rename_feed": {
        const { feedId, title } = parseMockArgs("rename_feed", browserMockCommandArgsSchemas.rename_feed, rawPayload);
        const feed = mockFeeds.find((f) => f.id === feedId);
        if (feed) feed.title = title;
        return null;
      }

      case "update_feed_folder": {
        const { feedId, folderId } = parseMockArgs(
          "update_feed_folder",
          browserMockCommandArgsSchemas.update_feed_folder,
          rawPayload,
        );
        const targetFeed = mockFeeds.find((f) => f.id === feedId);
        if (targetFeed) targetFeed.folder_id = folderId;
        return null;
      }

      case "update_feed_display_settings": {
        const { feedId, readerMode, webPreviewMode } = parseMockArgs(
          "update_feed_display_settings",
          browserMockCommandArgsSchemas.update_feed_display_settings,
          rawPayload,
        );
        const dmFeed = mockFeeds.find((f) => f.id === feedId);
        if (dmFeed) {
          dmFeed.reader_mode = readerMode;
          dmFeed.web_preview_mode = webPreviewMode;
        }
        return null;
      }

      case "discover_feeds": {
        const { url } = parseMockArgs("discover_feeds", browserMockCommandArgsSchemas.discover_feeds, rawPayload);
        // Simulate discovery: if URL looks like a feed, return it directly
        if (/\.(xml|rss|atom|json)$/i.test(url) || /\/feed\/?$/i.test(url)) {
          return [{ url, title: "" }];
        }
        // Otherwise simulate finding feeds on a site
        return [
          { url: `${url.replace(/\/$/, "")}/feed`, title: "Main Feed" },
          {
            url: `${url.replace(/\/$/, "")}/comments/feed`,
            title: "Comments Feed",
          },
        ];
      }

      case "open_in_browser": {
        const { url } = parseMockArgs("open_in_browser", browserMockCommandArgsSchemas.open_in_browser, rawPayload);
        window.open(url, "_blank");
        return null;
      }

      case "plugin:opener|open_url": {
        const { url } = parseMockArgs(
          "plugin:opener|open_url",
          browserMockCommandArgsSchemas["plugin:opener|open_url"],
          rawPayload,
        );
        window.open(url, "_blank");
        return null;
      }

      case "go_back_browser_webview":
      case "go_forward_browser_webview":
      case "reload_browser_webview":
        return {
          url: "https://example.com/article",
          can_go_back: false,
          can_go_forward: false,
          is_loading: false,
        };

      case "close_browser_webview":
        return null;

      case "trigger_sync":
        return {
          synced: true,
          total: 1,
          succeeded: 1,
          failed: [],
          warnings: [],
        };

      case "trigger_startup_sync":
        parseMockArgs("trigger_startup_sync", browserMockCommandArgsSchemas.trigger_startup_sync, rawPayload);
        return {
          synced: true,
          total: 1,
          succeeded: 1,
          failed: [],
          warnings: [],
        };

      case "trigger_sync_account":
        parseMockArgs("trigger_sync_account", browserMockCommandArgsSchemas.trigger_sync_account, rawPayload);
        return {
          synced: true,
          total: 1,
          succeeded: 1,
          failed: [],
          warnings: [],
        };

      case "trigger_sync_feed":
        parseMockArgs("trigger_sync_feed", browserMockCommandArgsSchemas.trigger_sync_feed, rawPayload);
        return {
          synced: true,
          total: 1,
          succeeded: 1,
          failed: [],
          warnings: [],
        };
      case "trigger_automatic_sync":
        return {
          synced: false,
          total: 0,
          succeeded: 0,
          failed: [],
          warnings: [],
        };
      case "import_opml":
        return null;
      case "copy_to_clipboard":
        parseMockArgs("copy_to_clipboard", browserMockCommandArgsSchemas.copy_to_clipboard, rawPayload);
        return null;
      case "add_to_reading_list":
        parseMockArgs("add_to_reading_list", browserMockCommandArgsSchemas.add_to_reading_list, rawPayload);
        return null;
      case "get_database_info":
        return {
          db_size_bytes: 2_500_000,
          wal_size_bytes: 150_000,
          total_size_bytes: 2_650_000,
        };
      case "vacuum_database":
        return {
          db_size_bytes: 2_100_000,
          wal_size_bytes: 0,
          total_size_bytes: 2_100_000,
        };
      case "open_log_dir":
        return null;
      case "check_for_update":
        return null;
      case "download_and_install_update":
        return null;
      case "restart_app":
        return null;

      default:
        throw new Error(`[dev-mocks] Unknown command: ${cmd}`);
    }
  });
}
