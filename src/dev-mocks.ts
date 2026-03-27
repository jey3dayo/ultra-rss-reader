/**
 * Development mock for running outside Tauri (browser-only mode).
 * Automatically injects mockIPC when window.__TAURI_INTERNALS__ is not available.
 */

import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { AccountDto, FeedDto, TagDto } from "./api/tauri-commands";
import { mockAccounts, mockArticles, mockArticleTags, mockFeeds, mockFolders, mockTags } from "./dev-mock-data";

let nextAccountId = 100;
let nextFeedId = 100;
let nextTagId = 100;
const mockPreferences = new Map<string, string>();

function titleFromUrl(feedUrl: string): string {
  try {
    return new URL(feedUrl).hostname.replace(/^www\./, "");
  } catch {
    return feedUrl;
  }
}

export function setupDevMocks() {
  if (window.__TAURI_INTERNALS__) return;

  console.info("[dev-mocks] Tauri not detected, injecting mock IPC with rich data for browser debugging");

  mockWindows("main");
  mockIPC((cmd, payload) => {
    const args = payload as Record<string, unknown>;

    switch (cmd) {
      case "list_accounts":
        return mockAccounts;

      case "add_account": {
        const account: AccountDto = {
          id: `dev-acc-${nextAccountId++}`,
          kind: String(args.kind ?? "Local"),
          name: String(args.name ?? "Dev Account"),
          sync_interval_secs: 3600,
          sync_on_wake: false,
          keep_read_items_days: 30,
        };
        mockAccounts.push(account);
        return account;
      }

      case "update_account_sync": {
        const target = mockAccounts.find((a) => a.id === args.accountId);
        if (target) {
          target.sync_interval_secs = Number(args.syncIntervalSecs);
          target.sync_on_wake = Boolean(args.syncOnWake);
          target.keep_read_items_days = Number(args.keepReadItemsDays);
        }
        return target ?? null;
      }

      case "delete_account": {
        const idx = mockAccounts.findIndex((a) => a.id === args.accountId);
        if (idx >= 0) mockAccounts.splice(idx, 1);
        return null;
      }

      case "list_folders":
        return mockFolders.filter((f) => f.account_id === args.accountId);

      case "list_feeds":
        return mockFeeds.filter((f) => f.account_id === args.accountId);

      case "add_local_feed": {
        const feedId = `dev-feed-${nextFeedId++}`;
        const feedUrl = String(args.url ?? "");
        const feed: FeedDto = {
          id: feedId,
          account_id: String(args.accountId),
          folder_id: null,
          title: titleFromUrl(feedUrl),
          url: feedUrl,
          site_url: feedUrl,
          unread_count: 3,
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
            title: `Sample article ${i + 1} from ${feedUrl}`,
            content_sanitized: `<p>This is a sample article fetched from ${feedUrl}.</p>`,
            summary: `Sample summary for article ${i + 1}`,
            url: `${feedUrl}#article-${i}`,
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
        const feedId = args.feedId as string;
        return mockArticles.filter((a) => a.feed_id === feedId);
      }

      case "list_account_articles": {
        const feedIds = mockFeeds.filter((f) => f.account_id === args.accountId).map((f) => f.id);
        return mockArticles.filter((a) => feedIds.includes(a.feed_id));
      }

      case "search_articles":
        return mockArticles.filter((a) => a.title.toLowerCase().includes(String(args.query ?? "").toLowerCase()));

      case "mark_article_read": {
        const art = mockArticles.find((a) => a.id === args.articleId);
        if (art) art.is_read = (args.read as boolean | undefined) ?? true;
        return null;
      }

      case "mark_articles_read": {
        const ids = args.articleIds as string[];
        for (const id of ids) {
          const art = mockArticles.find((a) => a.id === id);
          if (art) art.is_read = true;
        }
        return null;
      }

      case "mark_feed_read": {
        for (const art of mockArticles) {
          if (art.feed_id === args.feedId) art.is_read = true;
        }
        return null;
      }

      case "mark_folder_read": {
        for (const art of mockArticles) {
          art.is_read = true;
        }
        return null;
      }

      case "toggle_article_star": {
        const art = mockArticles.find((a) => a.id === args.articleId);
        if (art) art.is_starred = args.starred as boolean;
        return null;
      }

      case "get_preferences":
        return Object.fromEntries(mockPreferences);

      case "set_preference": {
        mockPreferences.set(String(args.key), String(args.value));
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
        const tag: TagDto = {
          id: `dev-tag-${nextTagId++}`,
          name: String(args.name ?? ""),
          color: (args.color as string) ?? null,
        };
        mockTags.push(tag);
        return tag;
      }

      case "delete_tag": {
        const tagIdx = mockTags.findIndex((t) => t.id === args.tagId);
        if (tagIdx >= 0) mockTags.splice(tagIdx, 1);
        // Remove associated article_tags
        for (let i = mockArticleTags.length - 1; i >= 0; i--) {
          if (mockArticleTags[i].tag_id === args.tagId) mockArticleTags.splice(i, 1);
        }
        return null;
      }

      case "tag_article": {
        const exists = mockArticleTags.some((at) => at.article_id === args.articleId && at.tag_id === args.tagId);
        if (!exists) {
          mockArticleTags.push({
            article_id: String(args.articleId),
            tag_id: String(args.tagId),
          });
        }
        return null;
      }

      case "untag_article": {
        const atIdx = mockArticleTags.findIndex((at) => at.article_id === args.articleId && at.tag_id === args.tagId);
        if (atIdx >= 0) mockArticleTags.splice(atIdx, 1);
        return null;
      }

      case "get_article_tags": {
        const tagIds = mockArticleTags.filter((at) => at.article_id === args.articleId).map((at) => at.tag_id);
        return mockTags.filter((t) => tagIds.includes(t.id));
      }

      case "list_articles_by_tag": {
        const articleIds = mockArticleTags.filter((at) => at.tag_id === args.tagId).map((at) => at.article_id);
        return mockArticles.filter((a) => articleIds.includes(a.id));
      }

      case "delete_feed": {
        const feedIdx = mockFeeds.findIndex((f) => f.id === args.feedId);
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
        const feed = mockFeeds.find((f) => f.id === args.feedId);
        if (feed) feed.title = String(args.title);
        return null;
      }

      case "update_feed_folder": {
        const targetFeed = mockFeeds.find((f) => f.id === args.feedId);
        if (targetFeed) targetFeed.folder_id = (args.folderId as string) ?? null;
        return null;
      }

      case "open_in_browser": {
        const url = args.url as string | undefined;
        if (url) window.open(url, "_blank");
        return null;
      }

      case "trigger_sync":
      case "import_opml":
        return null;

      default:
        return null;
    }
  });
}
