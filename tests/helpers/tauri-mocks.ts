import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { AccountDto, ArticleDto, FeedDto } from "@/api/tauri-commands";

// --- Sample data ---

export const sampleAccounts: AccountDto[] = [
  {
    id: "acc-1",
    kind: "local",
    name: "Local",
    sync_interval_secs: 3600,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
  {
    id: "acc-2",
    kind: "freshrss",
    name: "FreshRSS",
    sync_interval_secs: 3600,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
];

export const sampleFeeds: FeedDto[] = [
  {
    id: "feed-1",
    account_id: "acc-1",
    folder_id: null,
    title: "Tech Blog",
    url: "https://example.com/feed.xml",
    site_url: "https://example.com",
    unread_count: 5,
  },
  {
    id: "feed-2",
    account_id: "acc-1",
    folder_id: null,
    title: "News",
    url: "https://example.com/news.xml",
    site_url: "https://example.com",
    unread_count: 0,
  },
];

export const sampleArticles: ArticleDto[] = [
  {
    id: "art-1",
    feed_id: "feed-1",
    title: "First Article",
    content_sanitized: "<p>Hello world</p>",
    summary: "A hello world article",
    url: "https://example.com/1",
    author: "Alice",
    published_at: "2026-03-25T10:00:00Z",
    thumbnail: null,
    is_read: false,
    is_starred: false,
  },
  {
    id: "art-2",
    feed_id: "feed-1",
    title: "Second Article",
    content_sanitized: "<p>Another post</p>",
    summary: null,
    url: "https://example.com/2",
    author: null,
    published_at: "2026-03-24T08:00:00Z",
    thumbnail: null,
    is_read: true,
    is_starred: true,
  },
];

// --- Mock setup ---

type MockHandler = (cmd: string, args: Record<string, unknown>) => unknown;

const defaultHandler: MockHandler = (cmd, args) => {
  switch (cmd) {
    case "list_accounts":
      return sampleAccounts;
    case "list_feeds":
      return sampleFeeds.filter((f) => f.account_id === args.accountId);
    case "list_articles":
      return sampleArticles.filter((a) => a.feed_id === args.feedId);
    case "list_account_articles":
      return sampleArticles.filter((a) =>
        sampleFeeds.some((f) => f.id === a.feed_id && f.account_id === args.accountId),
      );
    case "add_account":
      return {
        id: "acc-new",
        kind: String(args.kind),
        name: String(args.name),
        sync_interval_secs: 3600,
        sync_on_wake: false,
        keep_read_items_days: 30,
      } satisfies AccountDto;
    case "mark_article_read":
    case "mark_articles_read":
      return null;
    case "toggle_article_star":
      return null;
    case "search_articles":
      return [];
    case "add_local_feed":
      return {
        id: "feed-new",
        account_id: args.accountId,
        folder_id: null,
        title: "New Feed",
        url: args.url,
        site_url: args.url,
        unread_count: 0,
      };
    case "delete_account":
      return null;
    case "open_in_browser":
      return null;
    case "trigger_sync":
      return null;
    default:
      return null;
  }
};

/**
 * Set up Tauri IPC mocks. Call this in beforeEach.
 * Pass a custom handler to override specific commands.
 */
export function setupTauriMocks(handler?: MockHandler): void {
  mockWindows("main");
  mockIPC((cmd, payload) => {
    const args = (payload ?? {}) as Record<string, unknown>;
    if (handler) {
      return handler(cmd, args);
    }
    return defaultHandler(cmd, args);
  });
}

/**
 * Tear down Tauri IPC mocks. Call this in afterEach.
 */
export function teardownTauriMocks(): void {
  clearMocks();
}
