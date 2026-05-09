import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { getCommandArgsSchema } from "@/api/schemas";
import type {
  AccountDto,
  AccountSyncStatusDto,
  ArticleDto,
  DatabaseInfoDto,
  FeedArticleSummaryDto,
  MuteKeywordDto,
  TagDto,
} from "@/api/tauri-commands";
import { parseWithSchema } from "@/schemas/parse";
import {
  createSampleAccounts,
  createSampleArticles,
  createSampleFeeds,
  createSampleMuteKeywords,
  createSampleTags,
  sampleFolders,
} from "./fixtures";
import type {
  RawMockTauriCommandArgs,
  ValidatedMockTauriCommandArgs,
  ValidatedMockTauriCommandCall,
} from "./tauri-types";

// --- Mock setup ---

export type MockHandler = (cmd: string, args: ValidatedMockTauriCommandArgs) => unknown;

export function createTauriMockCallRecorder(handler?: MockHandler): {
  calls: ValidatedMockTauriCommandCall[];
  handler: MockHandler;
} {
  const calls: ValidatedMockTauriCommandCall[] = [];

  return {
    calls,
    handler: (cmd, args) => {
      calls.push({ cmd, args });
      return handler?.(cmd, args);
    },
  };
}

export const mockPlatformInfo = {
  kind: "windows",
  capabilities: {
    supports_reading_list: false,
    supports_background_browser_open: false,
    supports_runtime_window_icon_replacement: true,
    supports_native_browser_navigation: true,
    uses_dev_file_credentials: false,
  },
};

function isRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === "object" && payload !== null;
}

function toMockHandlerArgs(args: RawMockTauriCommandArgs): ValidatedMockTauriCommandArgs {
  return args as ValidatedMockTauriCommandArgs;
}

function validateArgs(cmd: string, payload: unknown): ValidatedMockTauriCommandArgs {
  const schema = getCommandArgsSchema(cmd);
  if (schema) {
    return toMockHandlerArgs(parseWithSchema(schema, payload));
  }
  return toMockHandlerArgs(isRecord(payload) ? payload : {});
}

function createDefaultHandler(): MockHandler {
  let mockTags = createSampleTags();

  return (cmd, args) => {
    switch (cmd) {
      case "list_accounts":
        return createSampleAccounts();
      case "list_feeds":
        return createSampleFeeds().filter((f) => f.account_id === args.accountId);
      case "list_folders":
        return structuredClone(sampleFolders.filter((folder) => folder.account_id === args.accountId));
      case "list_articles":
        return createSampleArticles().filter(
          (a) => a.feed_id === args.feedId && (!args.unreadOnly || !a.is_read) && (!args.starredOnly || a.is_starred),
        );
      case "list_account_articles":
        return createSampleArticles().filter((a) =>
          createSampleFeeds().some(
            (f) => f.id === a.feed_id && f.account_id === args.accountId && (!args.unreadOnly || !a.is_read),
          ),
        );
      case "list_folder_articles":
        return createSampleArticles().filter((a) =>
          createSampleFeeds().some((f) => {
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
        return createSampleArticles().filter(
          (a) => a.is_starred && createSampleFeeds().some((f) => f.id === a.feed_id && f.account_id === args.accountId),
        );
      case "list_feed_article_summaries": {
        const articles = createSampleArticles();
        return createSampleFeeds()
          .filter((feed) => feed.account_id === args.accountId)
          .map(
            (feed) =>
              ({
                feed_id: feed.id,
                latest_article_at:
                  articles
                    .filter((article) => article.feed_id === feed.id)
                    .map((article) => article.published_at)
                    .sort()
                    .slice(-1)[0] ?? null,
                starred_count: articles.filter((article) => article.feed_id === feed.id && article.is_starred).length,
              }) satisfies FeedArticleSummaryDto,
          );
      }
      case "list_recent_articles": {
        const articles = createSampleArticles();
        return [articles[1], articles[0]]
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
          .map((article) => ({
            ...article,
            viewed_at: "2026-04-20T10:00:00Z",
          }));
      }
      case "count_account_unread_articles":
        return createSampleArticles().filter((a) =>
          createSampleFeeds().some((f) => f.id === a.feed_id && f.account_id === args.accountId && !a.is_read),
        ).length;
      case "count_account_starred_articles":
        return createSampleArticles().filter((a) =>
          createSampleFeeds().some((f) => f.id === a.feed_id && f.account_id === args.accountId && a.is_starred),
        ).length;
      case "get_feed_integrity_report":
        return { orphaned_article_count: 0, orphaned_feeds: [] };
      case "cleanup_feed_integrity_orphans":
        return {
          dry_run: args.dryRun,
          orphaned_article_count: 0,
          deleted_article_count: 0,
        };
      case "add_account":
        return {
          id: "acc-new",
          kind: String(args.kind),
          name: String(args.name),
          display_name: String(args.name),
          icon_url: null,
          capabilities: {
            supports_folders: false,
            supports_starring: false,
            supports_search: false,
            supports_delta_sync: false,
            supports_remote_state: false,
          },
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
        return createSampleMuteKeywords();
      case "list_tags":
        return structuredClone(mockTags);
      case "create_tag": {
        const nextTag: TagDto = {
          id: `tag-${mockTags.length + 1}`,
          name: String(args.name),
          color: typeof args.color === "string" ? args.color : null,
        };
        mockTags = [...mockTags, nextTag];
        return structuredClone(nextTag);
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
        return structuredClone(nextTag);
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
      case "update_mute_keyword": {
        const muteKeywords = createSampleMuteKeywords();
        return {
          id: String(args.muteKeywordId),
          keyword: muteKeywords[0]?.keyword ?? "Kindle Unlimited",
          scope: String(args.scope) as "title" | "body" | "title_and_body",
          created_at: muteKeywords[0]?.created_at ?? "2026-04-15T01:00:00Z",
          updated_at: "2026-04-15T01:10:00Z",
        } satisfies MuteKeywordDto;
      }
      case "delete_mute_keyword":
        return null;
      case "set_mute_auto_mark_read":
        return null;
      case "get_preferences":
        return {};
      case "set_preference":
        return null;
      case "get_tag_article_counts":
        return {};
      case "add_local_feed":
        return {
          id: "feed-new",
          account_id: args.accountId,
          folder_id: null,
          remote_id: null,
          title: "New Feed",
          url: args.url,
          site_url: args.url,
          unread_count: 0,
          reader_mode: "inherit",
          web_preview_mode: "inherit",
        };
      case "test_account_connection":
        return createSampleAccounts().find((account) => account.id === args.accountId) ?? createSampleAccounts()[0];
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
      case "plugin:opener|open_url":
      case "open_log_dir":
        return null;
      case "plugin:event|listen":
        return 1;
      case "plugin:event|unlisten":
        return null;
      case "get_platform_info":
        return structuredClone(mockPlatformInfo);
      case "get_database_info":
        return {
          db_size_bytes: 1024,
          wal_size_bytes: 256,
          total_size_bytes: 1280,
        } satisfies DatabaseInfoDto;
      case "get_dev_runtime_options":
        return {
          dev_intent: null,
          dev_web_url: null,
          dev_window_width: null,
          dev_window_height: null,
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
      case "check_for_update":
        return null;
      default:
        throw new Error(`Unhandled Tauri mock command: ${cmd}`);
    }
  };
}

/**
 * Set up Tauri IPC mocks. Call this in beforeEach.
 * Pass a custom handler to override specific commands. Only `undefined`
 * falls back to the default mocks; `null`, `false`, and `0` are handled
 * responses.
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
