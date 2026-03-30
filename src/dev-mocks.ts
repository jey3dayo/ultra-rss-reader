/**
 * Development mock for running outside Tauri (browser-only mode).
 * Automatically injects mockIPC when window.__TAURI_INTERNALS__ is not available.
 */

import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import {
  addAccountArgs,
  addLocalFeedArgs,
  checkBrowserEmbedSupportArgs,
  countAccountUnreadArticlesArgs,
  createFolderArgs,
  createOrUpdateBrowserWebviewArgs,
  createTagArgs,
  deleteAccountArgs,
  deleteFeedArgs,
  deleteTagArgs,
  discoverFeedsArgs,
  getArticleTagsArgs,
  getTagArticleCountsArgs,
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
  setBrowserWebviewBoundsArgs,
  setPreferenceArgs,
  tagArticleArgs,
  toggleArticleStarArgs,
  untagArticleArgs,
  updateAccountSyncArgs,
  updateFeedDisplayModeArgs,
  updateFeedFolderArgs,
} from "./api/schemas";
import type { AccountDto, FeedDto, FolderDto, TagDto } from "./api/tauri-commands";
import { mockAccounts, mockArticles, mockArticleTags, mockFeeds, mockFolders, mockTags } from "./dev-mock-data";

let nextAccountId = 100;
let nextFeedId = 100;
let nextFolderId = 100;
let nextTagId = 100;
const mockPreferences = new Map<string, string>();

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

export function setupDevMocks() {
  if (window.__TAURI_INTERNALS__) return;

  console.info("[dev-mocks] Tauri not detected, injecting mock IPC with rich data for browser debugging");

  mockWindows("main");
  mockIPC(async (cmd, payload) => {
    switch (cmd) {
      case "list_accounts":
        return mockAccounts;

      case "add_account": {
        const { kind, name, serverUrl } = addAccountArgs.parse(payload);
        const account: AccountDto = {
          id: `dev-acc-${nextAccountId++}`,
          kind,
          name,
          username: null,
          server_url: serverUrl ?? null,
          sync_interval_secs: 3600,
          sync_on_wake: false,
          keep_read_items_days: 30,
        };
        mockAccounts.push(account);
        return account;
      }

      case "update_account_sync": {
        const { accountId, syncIntervalSecs, syncOnWake, keepReadItemsDays } = updateAccountSyncArgs.parse(payload);
        const target = mockAccounts.find((a) => a.id === accountId);
        if (target) {
          target.sync_interval_secs = syncIntervalSecs;
          target.sync_on_wake = syncOnWake;
          target.keep_read_items_days = keepReadItemsDays;
        }
        return target ?? null;
      }

      case "rename_account": {
        const { accountId, name } = renameAccountArgs.parse(payload);
        const target = mockAccounts.find((a) => a.id === accountId);
        if (target) {
          target.name = name;
        }
        return target ?? null;
      }

      case "test_account_connection":
        return true;

      case "delete_account": {
        const { accountId } = deleteAccountArgs.parse(payload);
        const idx = mockAccounts.findIndex((a) => a.id === accountId);
        if (idx >= 0) mockAccounts.splice(idx, 1);
        return null;
      }

      case "list_folders": {
        const { accountId } = listFoldersArgs.parse(payload);
        return mockFolders.filter((f) => f.account_id === accountId);
      }

      case "create_folder": {
        const { accountId, name } = createFolderArgs.parse(payload);
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
        const { accountId } = listFeedsArgs.parse(payload);
        return mockFeeds.filter((f) => f.account_id === accountId);
      }

      case "add_local_feed": {
        const { accountId, url } = addLocalFeedArgs.parse(payload);
        const feedId = `dev-feed-${nextFeedId++}`;
        const feed: FeedDto = {
          id: feedId,
          account_id: accountId,
          folder_id: null,
          title: titleFromUrl(url),
          url,
          site_url: url,
          unread_count: 3,
          display_mode: "normal",
        };
        mockFeeds.push(feed);
        // Generate sample articles for the new feed
        const now = new Date();
        for (let i = 0; i < 3; i++) {
          const pubDate = new Date(now);
          pubDate.setHours(pubDate.getHours() - i);
          mockArticles.push({
            id: `${feedId}-art-${i}`,
            feed_id: feedId,
            title: `Sample article ${i + 1} from ${url}`,
            content_sanitized: `<p>This is a sample article fetched from ${url}.</p>`,
            summary: `Sample summary for article ${i + 1}`,
            url: `${url}#article-${i}`,
            author: null,
            published_at: pubDate.toISOString(),
            thumbnail: null,
            is_read: false,
            is_starred: false,
          });
        }
        return feed;
      }

      case "list_articles": {
        const { feedId } = listArticlesArgs.parse(payload);
        return mockArticles.filter((a) => a.feed_id === feedId);
      }

      case "list_account_articles": {
        const { accountId } = listAccountArticlesArgs.parse(payload);
        const feedIds = mockFeeds.filter((f) => f.account_id === accountId).map((f) => f.id);
        return mockArticles.filter((a) => feedIds.includes(a.feed_id));
      }

      case "count_account_unread_articles": {
        const { accountId } = countAccountUnreadArticlesArgs.parse(payload);
        return countUnreadByAccount(accountId);
      }

      case "search_articles": {
        const { query } = searchArticlesArgs.parse(payload);
        return mockArticles.filter((a) => a.title.toLowerCase().includes(query.toLowerCase()));
      }

      case "mark_article_read": {
        const { articleId, read } = markArticleReadArgs.parse(payload);
        const art = mockArticles.find((a) => a.id === articleId);
        if (art) {
          art.is_read = read ?? true;
          recalcUnread(art.feed_id);
        }
        return null;
      }

      case "mark_articles_read": {
        const { articleIds } = markArticlesReadArgs.parse(payload);
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
        const { feedId } = markFeedReadArgs.parse(payload);
        for (const art of mockArticles) {
          if (art.feed_id === feedId) art.is_read = true;
        }
        recalcUnread(feedId);
        return null;
      }

      case "mark_folder_read": {
        const { folderId } = markFolderReadArgs.parse(payload);
        const folderFeedIds = mockFeeds.filter((f) => f.folder_id === folderId).map((f) => f.id);
        for (const art of mockArticles) {
          if (folderFeedIds.includes(art.feed_id)) art.is_read = true;
        }
        for (const fid of folderFeedIds) recalcUnread(fid);
        return null;
      }

      case "toggle_article_star": {
        const { articleId, starred } = toggleArticleStarArgs.parse(payload);
        const art = mockArticles.find((a) => a.id === articleId);
        if (art) art.is_starred = starred;
        return null;
      }

      case "get_preferences":
        return Object.fromEntries(mockPreferences);

      case "set_preference": {
        const { key, value } = setPreferenceArgs.parse(payload);
        mockPreferences.set(key, value);
        return null;
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
        const { name, color } = createTagArgs.parse(payload);
        const tag: TagDto = {
          id: `dev-tag-${nextTagId++}`,
          name,
          color: color ?? null,
        };
        mockTags.push(tag);
        return tag;
      }

      case "rename_tag": {
        const { tagId, name } = renameTagArgs.parse(payload);
        const renameIdx = mockTags.findIndex((t) => t.id === tagId);
        if (renameIdx >= 0) {
          mockTags[renameIdx].name = name;
          return mockTags[renameIdx];
        }
        return null;
      }

      case "delete_tag": {
        const { tagId } = deleteTagArgs.parse(payload);
        const tagIdx = mockTags.findIndex((t) => t.id === tagId);
        if (tagIdx >= 0) mockTags.splice(tagIdx, 1);
        // Remove associated article_tags
        for (let i = mockArticleTags.length - 1; i >= 0; i--) {
          if (mockArticleTags[i].tag_id === tagId) mockArticleTags.splice(i, 1);
        }
        return null;
      }

      case "tag_article": {
        const { articleId, tagId } = tagArticleArgs.parse(payload);
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
        const { articleId, tagId } = untagArticleArgs.parse(payload);
        const atIdx = mockArticleTags.findIndex((at) => at.article_id === articleId && at.tag_id === tagId);
        if (atIdx >= 0) mockArticleTags.splice(atIdx, 1);
        return null;
      }

      case "get_article_tags": {
        const { articleId } = getArticleTagsArgs.parse(payload);
        const tagIds = mockArticleTags.filter((at) => at.article_id === articleId).map((at) => at.tag_id);
        return mockTags.filter((t) => tagIds.includes(t.id));
      }

      case "list_articles_by_tag": {
        const { tagId, accountId } = listArticlesByTagArgs.parse(payload);
        const articleIds = mockArticleTags.filter((at) => at.tag_id === tagId).map((at) => at.article_id);
        let filtered = mockArticles.filter((a) => articleIds.includes(a.id));
        if (accountId) {
          const feedIds = mockFeeds.filter((f) => f.account_id === accountId).map((f) => f.id);
          filtered = filtered.filter((a) => feedIds.includes(a.feed_id));
        }
        return filtered;
      }

      case "get_tag_article_counts": {
        const { accountId } = getTagArticleCountsArgs.parse(payload);
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
        const { url } = checkBrowserEmbedSupportArgs.parse(payload);
        try {
          const host = new URL(url).hostname;
          return !host.endsWith("note.com");
        } catch {
          return true;
        }
      }

      case "create_or_update_browser_webview": {
        const { url } = createOrUpdateBrowserWebviewArgs.parse(payload);
        return {
          url,
          can_go_back: false,
          can_go_forward: false,
          is_loading: true,
        };
      }

      case "set_browser_webview_bounds": {
        setBrowserWebviewBoundsArgs.parse(payload);
        return null;
      }

      case "delete_feed": {
        const { feedId } = deleteFeedArgs.parse(payload);
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
        const { feedId, title } = renameFeedArgs.parse(payload);
        const feed = mockFeeds.find((f) => f.id === feedId);
        if (feed) feed.title = title;
        return null;
      }

      case "update_feed_folder": {
        const { feedId, folderId } = updateFeedFolderArgs.parse(payload);
        const targetFeed = mockFeeds.find((f) => f.id === feedId);
        if (targetFeed) targetFeed.folder_id = folderId;
        return null;
      }

      case "update_feed_display_mode": {
        const { feedId, displayMode } = updateFeedDisplayModeArgs.parse(payload);
        const dmFeed = mockFeeds.find((f) => f.id === feedId);
        if (dmFeed) dmFeed.display_mode = displayMode;
        return null;
      }

      case "discover_feeds": {
        const { url } = discoverFeedsArgs.parse(payload);
        // Simulate discovery: if URL looks like a feed, return it directly
        if (/\.(xml|rss|atom|json)$/i.test(url) || /\/feed\/?$/i.test(url)) {
          return [{ url, title: "" }];
        }
        // Otherwise simulate finding feeds on a site
        return [
          { url: `${url.replace(/\/$/, "")}/feed`, title: "Main Feed" },
          { url: `${url.replace(/\/$/, "")}/comments/feed`, title: "Comments Feed" },
        ];
      }

      case "open_in_browser": {
        const { url } = openInBrowserArgs.parse(payload);
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
      case "trigger_sync_account":
        return { synced: true, total: 1, succeeded: 1, failed: [] };
      case "trigger_automatic_sync":
        return { synced: false, total: 0, succeeded: 0, failed: [] };
      case "import_opml":
        return null;
      case "copy_to_clipboard":
        return null;
      case "add_to_reading_list":
        return null;
      case "get_database_info":
        return { db_size_bytes: 2_500_000, wal_size_bytes: 150_000, total_size_bytes: 2_650_000 };
      case "vacuum_database":
        return { db_size_bytes: 2_100_000, wal_size_bytes: 0, total_size_bytes: 2_100_000 };
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
