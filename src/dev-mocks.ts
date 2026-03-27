/**
 * Development mock for running outside Tauri (browser-only mode).
 * Automatically injects mockIPC when window.__TAURI_INTERNALS__ is not available.
 */

import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { AccountDto, FeedDto } from "./api/tauri-commands";
import { mockAccounts, mockArticles, mockFeeds, mockFolders } from "./dev-mock-data";

let nextAccountId = 100;
let nextFeedId = 100;

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
        };
        mockAccounts.push(account);
        return account;
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

      case "search_articles":
        return mockArticles.filter((a) => a.title.toLowerCase().includes(String(args.query ?? "").toLowerCase()));

      case "mark_article_read": {
        const art = mockArticles.find((a) => a.id === args.articleId);
        if (art) art.is_read = true;
        return null;
      }

      case "toggle_article_star": {
        const art = mockArticles.find((a) => a.id === args.articleId);
        if (art) art.is_starred = args.starred as boolean;
        return null;
      }

      case "trigger_sync":
      case "open_in_browser":
      case "import_opml":
        return null;

      default:
        return null;
    }
  });
}
