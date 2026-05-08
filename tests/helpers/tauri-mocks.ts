import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { commandArgsSchemas } from "@/api/schemas";
import type { AccountDto, AccountSyncStatusDto, ArticleDto, MuteKeywordDto, TagDto } from "@/api/tauri-commands";
import { parseWithSchema } from "@/schemas/parse";
import { sampleAccounts, sampleArticles, sampleFeeds, sampleMuteKeywords, sampleTags } from "./fixtures";

export { sampleAccounts, sampleArticles, sampleFeeds, sampleMuteKeywords, sampleTags } from "./fixtures";

export type MockTauriCommandCall = {
  cmd: string;
  args: Record<string, unknown>;
};

// --- Mock setup ---

type MockHandler = (cmd: string, args: Record<string, unknown>) => unknown;

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === "object" && payload !== null;
}

function validateArgs(cmd: string, payload: unknown): Record<string, unknown> {
  const schema = commandArgsSchemas[cmd];
  if (schema) {
    return parseWithSchema(schema, payload);
  }
  return isRecord(payload) ? payload : {};
}

function createDefaultHandler(): MockHandler {
  let mockTags = sampleTags.map((tag) => ({ ...tag }));

  return (cmd, args) => {
    switch (cmd) {
      case "list_accounts":
        return sampleAccounts;
      case "list_feeds":
        return sampleFeeds.filter((f) => f.account_id === args.accountId);
      case "list_folders":
        return [];
      case "list_articles":
        return sampleArticles.filter(
          (a) => a.feed_id === args.feedId && (!args.unreadOnly || !a.is_read) && (!args.starredOnly || a.is_starred),
        );
      case "list_account_articles":
        return sampleArticles.filter((a) =>
          sampleFeeds.some(
            (f) => f.id === a.feed_id && f.account_id === args.accountId && (!args.unreadOnly || !a.is_read),
          ),
        );
      case "list_folder_articles":
        return sampleArticles.filter((a) =>
          sampleFeeds.some((f) => {
            if (f.id !== a.feed_id || f.folder_id !== args.folderId) {
              return false;
            }
            if (args.mode === "unread") {
              return !a.is_read;
            }
            if (args.mode === "starred") {
              return a.is_starred;
            }
            return true;
          }),
        );
      case "list_starred_articles":
        return sampleArticles.filter(
          (a) => a.is_starred && sampleFeeds.some((f) => f.id === a.feed_id && f.account_id === args.accountId),
        );
      case "list_recent_articles":
        return [sampleArticles[1], sampleArticles[0]]
          .filter((article): article is ArticleDto => article !== undefined)
          .filter((article) => {
            if (args.mode === "unread") {
              return !article.is_read;
            }
            if (args.mode === "starred") {
              return article.is_starred;
            }
            return true;
          })
          .slice(Number(args.offset ?? 0), Number(args.offset ?? 0) + Number(args.limit ?? 20))
          .map((article) => ({ ...article, viewed_at: "2026-04-20T10:00:00Z" }));
      case "count_account_unread_articles":
        return sampleArticles.filter((a) =>
          sampleFeeds.some((f) => f.id === a.feed_id && f.account_id === args.accountId && !a.is_read),
        ).length;
      case "count_account_starred_articles":
        return sampleArticles.filter((a) =>
          sampleFeeds.some((f) => f.id === a.feed_id && f.account_id === args.accountId && a.is_starred),
        ).length;
      case "get_feed_integrity_report":
        return { orphaned_article_count: 0, orphaned_feeds: [] };
      case "add_account":
        return {
          id: "acc-new",
          kind: String(args.kind),
          name: String(args.name),
          username: null,
          server_url: args.serverUrl != null ? String(args.serverUrl) : null,
          sync_interval_secs: 3600,
          sync_on_startup: true,
          sync_on_wake: false,
          keep_read_items_days: 30,
        } satisfies AccountDto;
      case "mark_article_read":
      case "mark_articles_read":
      case "mark_account_read":
      case "mark_account_starred_read":
      case "mark_old_unread_read":
      case "unstar_account_articles":
      case "record_article_view":
        return null;
      case "count_old_unread_articles":
        return 1;
      case "clear_article_view_history":
        return 1;
      case "toggle_article_star":
        return null;
      case "search_articles":
        return [];
      case "list_mute_keywords":
        return sampleMuteKeywords;
      case "list_tags":
        return mockTags;
      case "create_tag": {
        const nextTag: TagDto = {
          id: `tag-${mockTags.length + 1}`,
          name: String(args.name),
          color: typeof args.color === "string" ? args.color : null,
        };
        mockTags = [...mockTags, nextTag];
        return nextTag;
      }
      case "rename_tag": {
        const targetTagId = String(args.tagId);
        const renamedTag = mockTags.find((tag) => tag.id === targetTagId);

        if (!renamedTag) {
          throw new Error("Tag not found");
        }

        const nextTag = {
          ...renamedTag,
          name: String(args.name),
          color: typeof args.color === "string" ? args.color : args.color === null ? null : renamedTag.color,
        };
        mockTags = mockTags.map((tag) => (tag.id === targetTagId ? nextTag : tag));
        return nextTag;
      }
      case "delete_tag":
        mockTags = mockTags.filter((tag) => tag.id !== String(args.tagId));
        return null;
      case "create_mute_keyword":
        return {
          id: "mute-new",
          keyword: String(args.keyword),
          scope: String(args.scope) as "title" | "body" | "title_and_body",
          created_at: "2026-04-15T01:00:00Z",
          updated_at: "2026-04-15T01:00:00Z",
        } satisfies MuteKeywordDto;
      case "update_mute_keyword":
        return {
          id: String(args.muteKeywordId),
          keyword: sampleMuteKeywords[0]?.keyword ?? "Kindle Unlimited",
          scope: String(args.scope) as "title" | "body" | "title_and_body",
          created_at: sampleMuteKeywords[0]?.created_at ?? "2026-04-15T01:00:00Z",
          updated_at: "2026-04-15T01:10:00Z",
        } satisfies MuteKeywordDto;
      case "delete_mute_keyword":
        return null;
      case "set_mute_auto_mark_read":
        return null;
      case "set_preference":
        return null;
      case "get_tag_article_counts":
        return {};
      case "add_local_feed":
        return {
          id: "feed-new",
          account_id: args.accountId,
          folder_id: null,
          title: "New Feed",
          url: args.url,
          site_url: args.url,
          unread_count: 0,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
        };
      case "test_account_connection":
        return sampleAccounts.find((account) => account.id === args.accountId) ?? sampleAccounts[0];
      case "delete_account":
        return null;
      case "get_account_sync_status":
        return {
          last_success_at: null,
          last_error: null,
          error_count: 0,
          next_retry_at: null,
        } satisfies AccountSyncStatusDto;
      case "open_in_browser":
        return null;
      case "get_platform_info":
        return {
          kind: "windows",
          capabilities: {
            supports_reading_list: false,
            supports_background_browser_open: false,
            supports_runtime_window_icon_replacement: true,
            supports_native_browser_navigation: true,
            uses_dev_file_credentials: false,
          },
        };
      case "check_browser_embed_support":
        return true;
      case "create_or_update_browser_webview":
        return {
          url: args.url,
          can_go_back: false,
          can_go_forward: false,
          is_loading: true,
        };
      case "set_browser_webview_bounds":
        return null;
      case "focus_browser_webview":
        return null;
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
        return { synced: true, total: 1, succeeded: 1, failed: [], warnings: [] };
      case "trigger_automatic_sync":
        return { synced: false, total: 0, succeeded: 0, failed: [], warnings: [] };
      default:
        return undefined;
    }
  };
}

/**
 * Set up Tauri IPC mocks. Call this in beforeEach.
 * Pass a custom handler to override specific commands.
 */
export function setupTauriMocks(handler?: MockHandler): void {
  const defaultHandler = createDefaultHandler();
  mockWindows("main");
  mockIPC((cmd, payload) => {
    const args = validateArgs(cmd, payload);
    if (handler) {
      const handled = handler(cmd, args);
      if (handled !== undefined) {
        return handled;
      }
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
