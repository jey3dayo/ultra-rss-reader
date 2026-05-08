/**
 * Development mock for running outside Tauri (browser-only mode).
 * Automatically injects mockIPC when window.__TAURI_INTERNALS__ is not available.
 */

import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import {
  addAccountArgs,
  addLocalFeedArgs,
  checkBrowserEmbedSupportArgs,
  clearArticleViewHistoryArgs,
  countAccountStarredArticlesArgs,
  countAccountUnreadArticlesArgs,
  createFolderArgs,
  createMuteKeywordArgs,
  createOrUpdateBrowserWebviewArgs,
  createTagArgs,
  deleteAccountArgs,
  deleteFeedArgs,
  deleteMuteKeywordArgs,
  deleteTagArgs,
  discoverFeedsArgs,
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
  markAccountReadArgs,
  markArticleReadArgs,
  markArticlesReadArgs,
  markFeedReadArgs,
  markFolderReadArgs,
  oldUnreadArticlesArgs,
  openInBrowserArgs,
  recordArticleViewArgs,
  renameAccountArgs,
  renameFeedArgs,
  renameTagArgs,
  searchArticlesArgs,
  setBrowserWebviewBoundsArgs,
  setMuteAutoMarkReadArgs,
  setPreferenceArgs,
  tagArticleArgs,
  testAccountConnectionArgs,
  toggleArticleStarArgs,
  unstarAccountArticlesArgs,
  untagArticleArgs,
  updateAccountSyncArgs,
  updateFeedDisplaySettingsArgs,
  updateFeedFolderArgs,
  updateMuteKeywordArgs,
} from "@/api/schemas";
import type {
  AccountDto,
  AccountSyncStatusDto,
  ArticleDto,
  FeedDto,
  FolderDto,
  MuteKeywordDto,
  TagDto,
} from "@/api/tauri-commands";
import { mockAccounts, mockArticles, mockArticleTags, mockFeeds, mockFolders, mockTags } from "@/dev/mock-data";
import { addHours, getCurrentDate, getCurrentIsoTimestamp, toIsoTimestamp } from "@/lib/datetime";
import { readDevIntent, readDevWebUrl, readDevWindowSize } from "@/lib/dev-intent";
import { parseWithSchema as parseMockArgs } from "@/schemas/parse";

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
}[] = [
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
  const feedIds = mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id);
  return mockArticles.filter((article) => feedIds.includes(article.feed_id) && !article.is_read).length;
}

function countStarredByAccount(accountId: string) {
  const feedIds = mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id);
  return mockArticles.filter((article) => feedIds.includes(article.feed_id) && article.is_starred).length;
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
  if (window.__TAURI_INTERNALS__) return;
  window.__DEV_BROWSER_MOCKS__ = true;
  window.__ULTRA_RSS_BROWSER_MOCKS__ = true;

  const feedIntegrityReport = { orphaned_article_count: 0, orphaned_feeds: [] };

  console.info("[dev-mocks] Tauri not detected, injecting mock IPC with rich data for browser debugging");

  mockWindows("main");
  mockIPC(async (cmd, payload) => {
    switch (cmd) {
      case "list_accounts":
        return mockAccounts;

      case "add_account": {
        const { kind, name, serverUrl } = parseMockArgs(addAccountArgs, payload);
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
          updateAccountSyncArgs,
          payload,
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

      case "rename_account": {
        const { accountId, name } = parseMockArgs(renameAccountArgs, payload);
        const target = mockAccounts.find((a) => a.id === accountId);
        if (target) {
          target.name = name;
        }
        return target ?? null;
      }

      case "test_account_connection": {
        const { accountId } = parseMockArgs(testAccountConnectionArgs, payload);
        return mockAccounts.find((account) => account.id === accountId) ?? mockAccounts[0] ?? null;
      }

      case "delete_account": {
        const { accountId } = parseMockArgs(deleteAccountArgs, payload);
        const idx = mockAccounts.findIndex((a) => a.id === accountId);
        if (idx >= 0) mockAccounts.splice(idx, 1);
        return null;
      }

      case "get_account_sync_status":
        return {
          last_success_at: null,
          last_error: null,
          error_count: 0,
          next_retry_at: null,
        } satisfies AccountSyncStatusDto;

      case "list_folders": {
        const { accountId } = parseMockArgs(listFoldersArgs, payload);
        return mockFolders.filter((f) => f.account_id === accountId);
      }

      case "create_folder": {
        const { accountId, name } = parseMockArgs(createFolderArgs, payload);
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
        const { accountId } = parseMockArgs(listFeedsArgs, payload);
        return mockFeeds.filter((f) => f.account_id === accountId);
      }

      case "add_local_feed": {
        const { accountId, url } = parseMockArgs(addLocalFeedArgs, payload);
        const feedId = `dev-feed-${nextFeedId++}`;
        const feed: FeedDto = {
          id: feedId,
          account_id: accountId,
          folder_id: null,
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
        } = parseMockArgs(listArticlesArgs, payload);
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
        } = parseMockArgs(listAccountArticlesArgs, payload);
        const feedIds = mockFeeds.filter((f) => f.account_id === accountId).map((f) => f.id);
        const articles = mockArticles.filter((a) => feedIds.includes(a.feed_id) && (!unreadOnly || !a.is_read));
        return applyMuteKeywordFilter(articles).slice(offset, offset + limit);
      }

      case "list_feed_article_summaries": {
        const { accountId } = parseMockArgs(listFeedArticleSummariesArgs, payload);
        const visibleArticles = applyMuteKeywordFilter(mockArticles);
        return mockFeeds
          .filter((feed) => feed.account_id === accountId)
          .map((feed) => {
            const feedArticles = visibleArticles.filter((article) => article.feed_id === feed.id);
            const latestArticleAt =
              feedArticles
                .map((article) => article.published_at)
                .filter((value) => !Number.isNaN(Date.parse(value)))
                .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
            return {
              feed_id: feed.id,
              latest_article_at: latestArticleAt,
              starred_count: feedArticles.filter((article) => article.is_starred).length,
            };
          });
      }

      case "list_folder_articles": {
        const { folderId, mode = "all", offset = 0, limit = 50 } = parseMockArgs(listFolderArticlesArgs, payload);
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
        const { accountId } = parseMockArgs(countAccountUnreadArticlesArgs, payload);
        return countUnreadByAccount(accountId);
      }

      case "count_account_starred_articles": {
        const { accountId } = parseMockArgs(countAccountStarredArticlesArgs, payload);
        return countStarredByAccount(accountId);
      }

      case "mark_account_read": {
        const { accountId } = parseMockArgs(markAccountReadArgs, payload);
        const feedIds = mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id);
        for (const article of mockArticles) {
          if (feedIds.includes(article.feed_id)) {
            article.is_read = true;
          }
        }
        for (const feedId of feedIds) recalcUnread(feedId);
        return null;
      }

      case "mark_account_starred_read": {
        const { accountId } = parseMockArgs(markAccountReadArgs, payload);
        const feedIds = mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id);
        const affectedFeedIds = new Set<string>();
        for (const article of mockArticles) {
          if (feedIds.includes(article.feed_id) && article.is_starred) {
            article.is_read = true;
            affectedFeedIds.add(article.feed_id);
          }
        }
        for (const feedId of affectedFeedIds) recalcUnread(feedId);
        return null;
      }

      case "count_old_unread_articles": {
        const { scopeKind, targetId, olderThanDays } = parseMockArgs(oldUnreadArticlesArgs, payload);
        return findOldUnreadArticles(scopeKind, targetId, olderThanDays).length;
      }

      case "mark_old_unread_read": {
        const { scopeKind, targetId, olderThanDays } = parseMockArgs(oldUnreadArticlesArgs, payload);
        const affectedFeedIds = new Set<string>();
        for (const article of findOldUnreadArticles(scopeKind, targetId, olderThanDays)) {
          article.is_read = true;
          affectedFeedIds.add(article.feed_id);
        }
        for (const feedId of affectedFeedIds) recalcUnread(feedId);
        return null;
      }

      case "unstar_account_articles": {
        const { accountId } = parseMockArgs(unstarAccountArticlesArgs, payload);
        const feedIds = mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id);
        for (const article of mockArticles) {
          if (feedIds.includes(article.feed_id)) {
            article.is_starred = false;
          }
        }
        return null;
      }

      case "list_starred_articles": {
        const { accountId } = parseMockArgs(listStarredArticlesArgs, payload);
        const feedIds = mockFeeds.filter((f) => f.account_id === accountId).map((f) => f.id);
        return applyMuteKeywordFilter(mockArticles.filter((a) => feedIds.includes(a.feed_id) && a.is_starred));
      }

      case "list_recent_articles": {
        const { accountId, mode = "all", offset = 0, limit = 20 } = parseMockArgs(listRecentArticlesArgs, payload);
        const feedIds = new Set(mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id));
        const articles = mockArticleViewHistory
          .filter((item) => item.accountId === accountId)
          .map((item): ArticleDto | null => {
            const article = mockArticles.find((candidate) => candidate.id === item.articleId);
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
          })
          .slice(offset, offset + limit);
        return applyMuteKeywordFilter(articles);
      }

      case "get_feed_integrity_report":
        return feedIntegrityReport;

      case "search_articles": {
        const { query } = parseMockArgs(searchArticlesArgs, payload);
        return applyMuteKeywordFilter(mockArticles.filter((a) => a.title.toLowerCase().includes(query.toLowerCase())));
      }

      case "list_mute_keywords":
        return [...mockMuteKeywords].sort((a, b) => b.created_at.localeCompare(a.created_at));

      case "create_mute_keyword": {
        const { keyword, scope } = parseMockArgs(createMuteKeywordArgs, payload);
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
        const { muteKeywordId, scope } = parseMockArgs(updateMuteKeywordArgs, payload);
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
        const { muteKeywordId } = parseMockArgs(deleteMuteKeywordArgs, payload);
        const index = mockMuteKeywords.findIndex((rule) => rule.id === muteKeywordId);
        if (index >= 0) {
          mockMuteKeywords.splice(index, 1);
        }
        return null;
      }

      case "mark_article_read": {
        const { articleId, read } = parseMockArgs(markArticleReadArgs, payload);
        const art = mockArticles.find((a) => a.id === articleId);
        if (art) {
          art.is_read = read ?? true;
          recalcUnread(art.feed_id);
        }
        return null;
      }

      case "record_article_view": {
        const { accountId, articleId } = parseMockArgs(recordArticleViewArgs, payload);
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
        const { accountId } = parseMockArgs(clearArticleViewHistoryArgs, payload);
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
        const { articleIds } = parseMockArgs(markArticlesReadArgs, payload);
        const affectedFeedIds = new Set<string>();
        for (const id of articleIds) {
          const art = mockArticles.find((a) => a.id === id);
          if (art) {
            art.is_read = true;
            affectedFeedIds.add(art.feed_id);
          }
        }
        for (const fid of affectedFeedIds) recalcUnread(fid);
        return null;
      }

      case "mark_feed_read": {
        const { feedId } = parseMockArgs(markFeedReadArgs, payload);
        for (const art of mockArticles) {
          if (art.feed_id === feedId) art.is_read = true;
        }
        recalcUnread(feedId);
        return null;
      }

      case "mark_folder_read": {
        const { folderId } = parseMockArgs(markFolderReadArgs, payload);
        const folderFeedIds = mockFeeds.filter((f) => f.folder_id === folderId).map((f) => f.id);
        for (const art of mockArticles) {
          if (folderFeedIds.includes(art.feed_id)) art.is_read = true;
        }
        for (const fid of folderFeedIds) recalcUnread(fid);
        return null;
      }

      case "toggle_article_star": {
        const { articleId, starred } = parseMockArgs(toggleArticleStarArgs, payload);
        const art = mockArticles.find((a) => a.id === articleId);
        if (art) art.is_starred = starred;
        return null;
      }

      case "get_preferences":
        return Object.fromEntries(mockPreferences);

      case "set_preference": {
        const { key, value } = parseMockArgs(setPreferenceArgs, payload);
        mockPreferences.set(key, value);
        return null;
      }

      case "set_mute_auto_mark_read": {
        const { enabled } = parseMockArgs(setMuteAutoMarkReadArgs, payload);
        mockPreferences.set("mute_auto_mark_read", String(enabled));
        return null;
      }

      case "get_platform_info":
        return {
          kind: "unknown",
          capabilities: {
            supports_reading_list: false,
            supports_background_browser_open: false,
            supports_runtime_window_icon_replacement: true,
            supports_native_browser_navigation: true,
            uses_dev_file_credentials: false,
          },
        };

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
        const { name, color } = parseMockArgs(createTagArgs, payload);
        const tag: TagDto = {
          id: `dev-tag-${nextTagId++}`,
          name,
          color: color ?? null,
        };
        mockTags.push(tag);
        return tag;
      }

      case "rename_tag": {
        const { tagId, name, color } = parseMockArgs(renameTagArgs, payload);
        const renameIdx = mockTags.findIndex((t) => t.id === tagId);
        if (renameIdx >= 0) {
          mockTags[renameIdx].name = name;
          mockTags[renameIdx].color = color ?? null;
          return mockTags[renameIdx];
        }
        throw { type: "UserVisible", message: "Tag not found" };
      }

      case "delete_tag": {
        const { tagId } = parseMockArgs(deleteTagArgs, payload);
        const tagIdx = mockTags.findIndex((t) => t.id === tagId);
        if (tagIdx >= 0) mockTags.splice(tagIdx, 1);
        // Remove associated article_tags
        for (let i = mockArticleTags.length - 1; i >= 0; i--) {
          if (mockArticleTags[i].tag_id === tagId) mockArticleTags.splice(i, 1);
        }
        return null;
      }

      case "tag_article": {
        const { articleId, tagId } = parseMockArgs(tagArticleArgs, payload);
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
        const { articleId, tagId } = parseMockArgs(untagArticleArgs, payload);
        const atIdx = mockArticleTags.findIndex((at) => at.article_id === articleId && at.tag_id === tagId);
        if (atIdx >= 0) mockArticleTags.splice(atIdx, 1);
        return null;
      }

      case "get_article_tags": {
        const { articleId } = parseMockArgs(getArticleTagsArgs, payload);
        const tagIds = mockArticleTags.filter((at) => at.article_id === articleId).map((at) => at.tag_id);
        return mockTags.filter((t) => tagIds.includes(t.id));
      }

      case "list_articles_by_tag": {
        const {
          tagId,
          accountId,
          mode = "all",
          offset = 0,
          limit = 50,
        } = parseMockArgs(listArticlesByTagArgs, payload);
        const articleIds = mockArticleTags.filter((at) => at.tag_id === tagId).map((at) => at.article_id);
        let filtered = mockArticles.filter((a) => articleIds.includes(a.id));
        if (accountId) {
          const feedIds = mockFeeds.filter((f) => f.account_id === accountId).map((f) => f.id);
          filtered = filtered.filter((a) => feedIds.includes(a.feed_id));
        }
        if (mode === "unread") {
          filtered = filtered.filter((article) => !article.is_read);
        } else if (mode === "starred") {
          filtered = filtered.filter((article) => article.is_starred);
        }
        return applyMuteKeywordFilter(filtered).slice(offset, offset + limit);
      }

      case "get_tag_article_counts": {
        const { accountId } = parseMockArgs(getTagArticleCountsArgs, payload);
        const counts: Record<string, number> = {};
        for (const at of mockArticleTags) {
          if (accountId) {
            const article = mockArticles.find((a) => a.id === at.article_id);
            if (!article) continue;
            const feed = mockFeeds.find((f) => f.id === article.feed_id);
            if (!feed || feed.account_id !== accountId) continue;
          }
          counts[at.tag_id] = (counts[at.tag_id] ?? 0) + 1;
        }
        return counts;
      }

      case "check_browser_embed_support": {
        const { url } = parseMockArgs(checkBrowserEmbedSupportArgs, payload);
        try {
          const host = new URL(url).hostname;
          return !host.endsWith("note.com");
        } catch {
          return true;
        }
      }

      case "create_or_update_browser_webview": {
        const { url } = parseMockArgs(createOrUpdateBrowserWebviewArgs, payload);
        return {
          url,
          can_go_back: false,
          can_go_forward: false,
          is_loading: false,
        };
      }

      case "set_browser_webview_bounds":
        parseMockArgs(setBrowserWebviewBoundsArgs, payload);
        return null;

      case "focus_browser_webview":
        return null;

      case "delete_feed": {
        const { feedId } = parseMockArgs(deleteFeedArgs, payload);
        const feedIdx = mockFeeds.findIndex((f) => f.id === feedId);
        if (feedIdx >= 0) {
          const removed = mockFeeds.splice(feedIdx, 1)[0];
          // Remove associated articles
          for (let i = mockArticles.length - 1; i >= 0; i--) {
            if (mockArticles[i].feed_id === removed.id) mockArticles.splice(i, 1);
          }
        }
        return null;
      }

      case "rename_feed": {
        const { feedId, title } = parseMockArgs(renameFeedArgs, payload);
        const feed = mockFeeds.find((f) => f.id === feedId);
        if (feed) feed.title = title;
        return null;
      }

      case "update_feed_folder": {
        const { feedId, folderId } = parseMockArgs(updateFeedFolderArgs, payload);
        const targetFeed = mockFeeds.find((f) => f.id === feedId);
        if (targetFeed) targetFeed.folder_id = folderId;
        return null;
      }

      case "update_feed_display_settings": {
        const { feedId, readerMode, webPreviewMode } = parseMockArgs(updateFeedDisplaySettingsArgs, payload);
        const dmFeed = mockFeeds.find((f) => f.id === feedId);
        if (dmFeed) {
          dmFeed.reader_mode = readerMode;
          dmFeed.web_preview_mode = webPreviewMode;
        }
        return null;
      }

      case "discover_feeds": {
        const { url } = parseMockArgs(discoverFeedsArgs, payload);
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
        const { url } = parseMockArgs(openInBrowserArgs, payload);
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
      case "trigger_startup_sync":
      case "trigger_sync_account":
      case "trigger_sync_feed":
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
        return null;
      case "add_to_reading_list":
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
      case "get_log_dir":
        return "/tmp/mock-logs";
      case "check_for_update":
        return null;
      case "download_and_install_update":
        return null;
      case "restart_app":
        return null;

      default:
        return null;
    }
  });
}
