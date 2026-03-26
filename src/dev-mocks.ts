/**
 * Development mock for running outside Tauri (browser-only mode).
 * Automatically injects mockIPC when window.__TAURI_INTERNALS__ is not available.
 * This enables debugging via Chrome DevTools / Claude Code.
 */

import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { AccountDto, ArticleDto, FeedDto } from "./api/tauri-commands";

const mockAccounts: AccountDto[] = [];
const mockFeeds: FeedDto[] = [];
const mockArticles: ArticleDto[] = [];

let nextAccountId = 1;
let nextFeedId = 1;

export function setupDevMocks() {
  // Only mock if not running inside Tauri
  if (window.__TAURI_INTERNALS__) return;

  console.info("[dev-mocks] Tauri not detected, injecting mock IPC for browser debugging");

  mockWindows("main");
  mockIPC((cmd, payload) => {
    const args = payload as Record<string, unknown>;
    console.debug(`[dev-mocks] invoke("${cmd}",`, args, ")");

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
        console.info("[dev-mocks] Account added:", account);
        return account;
      }

      case "delete_account": {
        const idx = mockAccounts.findIndex((a) => a.id === args.accountId);
        if (idx >= 0) mockAccounts.splice(idx, 1);
        return null;
      }

      case "list_feeds":
        return mockFeeds.filter((f) => f.account_id === args.accountId);

      case "add_local_feed": {
        const feed: FeedDto = {
          id: `dev-feed-${nextFeedId++}`,
          account_id: String(args.accountId),
          title: `Feed: ${args.url}`,
          url: String(args.url ?? ""),
          unread_count: 0,
        };
        mockFeeds.push(feed);
        console.info("[dev-mocks] Feed added:", feed);
        return feed;
      }

      case "list_articles":
        return mockArticles.filter((a) => a.feed_id === args.feedId);

      case "search_articles":
        return mockArticles.filter((a) => a.title.toLowerCase().includes(String(args.query ?? "").toLowerCase()));

      case "mark_article_read":
      case "toggle_article_star":
      case "trigger_sync":
      case "open_in_browser":
      case "import_opml":
        return null;

      default:
        console.warn(`[dev-mocks] Unhandled command: ${cmd}`);
        return null;
    }
  });
}
