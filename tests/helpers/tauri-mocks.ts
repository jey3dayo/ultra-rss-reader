import { clearMocks, mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { getCommandArgsSchema } from "@/api/schemas";
import type {
  AccountDto,
  AccountSyncStatusDto,
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
  createSampleFolders,
  createSampleMuteKeywords,
  createSampleTags,
} from "./api-fixtures";
import type {
  RawMockTauriCommandArgs,
  ValidatedMockTauriCommandArgs,
  ValidatedMockTauriCommandCall,
} from "./tauri-types";

// --- Mock setup ---

export type MockHandler = (cmd: string, args: ValidatedMockTauriCommandArgs) => unknown;

let installedTauriMockWindowShim = false;

function ensureTauriMockWindow(): void {
  if (typeof globalThis.window !== "undefined") {
    return;
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: globalThis,
    writable: true,
  });
  installedTauriMockWindowShim = true;
}

function restoreTauriMockWindow(): void {
  if (!installedTauriMockWindowShim) {
    return;
  }

  Reflect.deleteProperty(globalThis, "window");
  installedTauriMockWindowShim = false;
}

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
    // Test IPC mocks fail fast so handlers never observe unvalidated command payloads.
    return toMockHandlerArgs(parseWithSchema(schema, payload));
  }
  return toMockHandlerArgs(isRecord(payload) ? payload : {});
}

function paginate<T>(items: readonly T[], args: ValidatedMockTauriCommandArgs): T[] {
  const offset = typeof args.offset === "number" ? args.offset : 0;
  const limit = typeof args.limit === "number" ? args.limit : 20;

  return items.slice(offset, offset + limit);
}

function createDefaultHandler(): MockHandler {
  const mockFeeds = createSampleFeeds();
  let mockArticles = createSampleArticles();
  let mockTags = createSampleTags();

  return (cmd, args) => {
    switch (cmd) {
      case "list_accounts":
        return createSampleAccounts();
      case "list_feeds":
        return structuredClone(mockFeeds.filter((f) => f.account_id === args.accountId));
      case "list_folders":
        return createSampleFolders().filter((folder) => folder.account_id === args.accountId);
      case "list_articles":
        return structuredClone(
          paginate(
            mockArticles.filter(
              (a) =>
                a.feed_id === args.feedId && (!args.unreadOnly || !a.is_read) && (!args.starredOnly || a.is_starred),
            ),
            args,
          ),
        );
      case "list_account_articles":
        return structuredClone(
          paginate(
            mockArticles.filter((a) =>
              mockFeeds.some(
                (f) => f.id === a.feed_id && f.account_id === args.accountId && (!args.unreadOnly || !a.is_read),
              ),
            ),
            args,
          ),
        );
      case "list_folder_articles":
        return structuredClone(
          paginate(
            mockArticles.filter((a) =>
              mockFeeds.some((f) => {
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
            ),
            args,
          ),
        );
      case "list_starred_articles":
        return structuredClone(
          paginate(
            mockArticles.filter((a) =>
              mockFeeds.some((f) => f.id === a.feed_id && f.account_id === args.accountId && a.is_starred),
            ),
            args,
          ),
        );
      case "list_feed_article_summaries": {
        return mockFeeds
          .filter((feed) => feed.account_id === args.accountId)
          .map(
            (feed) =>
              ({
                feed_id: feed.id,
                latest_article_at:
                  mockArticles
                    .filter((article) => article.feed_id === feed.id)
                    .map((article) => article.published_at)
                    .toSorted()
                    .slice(-1)[0] ?? null,
                starred_count: mockArticles.filter((article) => article.feed_id === feed.id && article.is_starred)
                  .length,
              }) satisfies FeedArticleSummaryDto,
          );
      }
      case "list_recent_articles": {
        return structuredClone(
          paginate(
            mockArticles
              .filter((article) =>
                mockFeeds.some(
                  (feed) =>
                    feed.id === article.feed_id &&
                    feed.account_id === args.accountId &&
                    (args.mode !== "unread" || !article.is_read) &&
                    (args.mode !== "starred" || article.is_starred),
                ),
              )
              .toReversed()
              .map((article) => ({
                ...article,
                viewed_at: "2026-04-20T10:00:00Z",
              })),
            args,
          ),
        );
      }
      case "count_account_unread_articles":
        return mockArticles.filter((a) =>
          mockFeeds.some((f) => f.id === a.feed_id && f.account_id === args.accountId && !a.is_read),
        ).length;
      case "count_account_starred_articles":
        return mockArticles.filter((a) =>
          mockFeeds.some((f) => f.id === a.feed_id && f.account_id === args.accountId && a.is_starred),
        ).length;
      case "get_feed_integrity_report":
        return { orphaned_article_count: 0, orphaned_feeds: [] };
      case "cleanup_feed_integrity_orphans":
        return {
          dry_run: args.dryRun,
          orphaned_article_count: 0,
          deleted_article_count: 0,
          ...(args.dryRun ? { orphaned_article_ids: [] } : {}),
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
        mockArticles = mockArticles.map((article) =>
          article.id === args.articleId ? { ...article, is_read: args.read !== false } : article,
        );
        return null;
      case "mark_articles_read": {
        const articleIds = new Set(args.articleIds);
        mockArticles = mockArticles.map((article) =>
          articleIds.has(article.id) ? { ...article, is_read: true } : article,
        );
        return null;
      }
      case "mark_account_read":
      case "mark_account_starred_read": {
        const accountFeedIds = new Set(
          mockFeeds.filter((feed) => feed.account_id === args.accountId).map((feed) => feed.id),
        );
        mockArticles = mockArticles.map((article) =>
          accountFeedIds.has(article.feed_id) && (cmd !== "mark_account_starred_read" || article.is_starred)
            ? { ...article, is_read: true }
            : article,
        );
        return null;
      }
      case "unstar_account_articles": {
        const accountFeedIds = new Set(
          mockFeeds.filter((feed) => feed.account_id === args.accountId).map((feed) => feed.id),
        );
        mockArticles = mockArticles.map((article) =>
          accountFeedIds.has(article.feed_id) ? { ...article, is_starred: false } : article,
        );
        return null;
      }
      case "mark_old_unread_read":
      case "record_article_view":
        return null;
      case "count_old_unread_articles":
        return 1;
      case "clear_article_view_history":
        return 1;
      case "toggle_article_star":
        mockArticles = mockArticles.map((article) =>
          article.id === args.articleId ? { ...article, is_starred: args.starred === true } : article,
        );
        return null;
      case "search_articles":
        return structuredClone(paginate([], args));
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
          shm_size_bytes: 0,
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
          load_generation: 1,
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
          load_generation: 1,
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
      case "plugin:window|set_always_on_top":
      case "plugin:window|set_badge_count":
      case "plugin:window|set_icon":
        return null;
      case "plugin:window|is_always_on_top":
        return false;
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
  ensureTauriMockWindow();
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
  ensureTauriMockWindow();
  clearMocks();
  restoreTauriMockWindow();
}
