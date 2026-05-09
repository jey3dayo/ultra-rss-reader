/**
 * Development mock for running outside Tauri (browser-only mode).
 * Automatically injects mockIPC when window.__TAURI_INTERNALS__ is not available.
 */

import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { z } from "zod";
import { type CommandArgsSchemaRegistry, commandArgsSchemas } from "@/api/schemas";
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
const browserMockCommandArgsSchemas: CommandArgsSchemaRegistry = commandArgsSchemas satisfies Record<
  string,
  MockCommandArgsSchema
>;
type BrowserMockCommandArgsSchemas = CommandArgsSchemaRegistry;
type MockCommandWithArgs = keyof BrowserMockCommandArgsSchemas;
type ParsedBrowserMockArgs<TCommand extends MockCommandWithArgs> = z.output<BrowserMockCommandArgsSchemas[TCommand]>;
type RawMockIpcPayload = unknown;
type DevMockWindowGlobalName = "__DEV_BROWSER_MOCKS__" | "__ULTRA_RSS_BROWSER_MOCKS__";
type DevMockWindowGlobalsSnapshot = Record<DevMockWindowGlobalName, PropertyDescriptor | undefined>;
type DevMockDiagnostic = {
  kind: "unknown-command";
  command: string;
  message: string;
};
type DevMockDiagnosticsWindow = Window & {
  __ULTRA_RSS_DEV_MOCK_DIAGNOSTICS__?: DevMockDiagnostic[];
};
export type RestoreDevMocks = () => void;

const DEV_MOCK_DIAGNOSTICS_ELEMENT_ID = "ultra-rss-dev-mock-diagnostics";
const DEV_MOCK_DIAGNOSTICS_EVENT = "ultra-rss-dev-mock-diagnostics";

function parseMockArgs<TCommand extends MockCommandWithArgs>(
  command: TCommand,
  rawIpcPayload: RawMockIpcPayload,
): ParsedBrowserMockArgs<TCommand>;
function parseMockArgs(command: MockCommandWithArgs, rawIpcPayload: RawMockIpcPayload): Record<string, unknown> {
  return browserMockCommandArgsSchemas[command].parse(rawIpcPayload);
}

function parseBrowserMockArgs<TCommand extends MockCommandWithArgs>(
  command: TCommand,
  rawIpcPayload: RawMockIpcPayload,
): ParsedBrowserMockArgs<TCommand>;
function parseBrowserMockArgs(command: MockCommandWithArgs, rawIpcPayload: RawMockIpcPayload) {
  return parseMockArgs(command, rawIpcPayload);
}

function cloneMockResponse<T>(value: T): T {
  return structuredClone(value);
}

function devMockDiagnosticsWindow(): DevMockDiagnosticsWindow {
  return window as DevMockDiagnosticsWindow;
}

function ensureDevMockDiagnosticsCanvas(): HTMLElement {
  const existing = document.getElementById(DEV_MOCK_DIAGNOSTICS_ELEMENT_ID);
  if (existing) {
    return existing;
  }

  const element = document.createElement("aside");
  element.id = DEV_MOCK_DIAGNOSTICS_ELEMENT_ID;
  element.dataset.testid = "dev-mock-diagnostics-canvas";
  element.setAttribute("aria-live", "polite");
  element.style.cssText = [
    "position: fixed",
    "right: 12px",
    "bottom: 12px",
    "z-index: 2147483647",
    "max-width: min(420px, calc(100vw - 24px))",
    "padding: 8px 10px",
    "border: 1px solid rgba(185, 28, 28, 0.35)",
    "border-radius: 8px",
    "background: rgba(254, 242, 242, 0.96)",
    "color: #7f1d1d",
    "font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    "box-shadow: 0 8px 24px rgba(127, 29, 29, 0.16)",
  ].join(";");
  document.body.append(element);
  return element;
}

function renderDevMockDiagnosticsCanvas(diagnostics: readonly DevMockDiagnostic[]) {
  if (diagnostics.length === 0) {
    document.getElementById(DEV_MOCK_DIAGNOSTICS_ELEMENT_ID)?.remove();
    return;
  }

  const latest = diagnostics[diagnostics.length - 1];
  ensureDevMockDiagnosticsCanvas().textContent = latest?.message ?? "";
}

function resetDevMockDiagnostics() {
  const targetWindow = devMockDiagnosticsWindow();
  targetWindow.__ULTRA_RSS_DEV_MOCK_DIAGNOSTICS__ = [];
  renderDevMockDiagnosticsCanvas([]);
}

function recordDevMockUnknownCommand(command: string): Error {
  const message = `[dev-mocks] Unknown command: ${command}`;
  const diagnostic: DevMockDiagnostic = {
    kind: "unknown-command",
    command,
    message,
  };
  const targetWindow = devMockDiagnosticsWindow();
  const diagnostics = targetWindow.__ULTRA_RSS_DEV_MOCK_DIAGNOSTICS__ ?? [];
  diagnostics.push(diagnostic);
  targetWindow.__ULTRA_RSS_DEV_MOCK_DIAGNOSTICS__ = diagnostics;
  renderDevMockDiagnosticsCanvas(diagnostics);
  window.dispatchEvent(new CustomEvent(DEV_MOCK_DIAGNOSTICS_EVENT, { detail: diagnostic }));
  return new Error(message);
}

function captureDevMockWindowGlobals(): DevMockWindowGlobalsSnapshot {
  return {
    __DEV_BROWSER_MOCKS__: Object.getOwnPropertyDescriptor(window, "__DEV_BROWSER_MOCKS__"),
    __ULTRA_RSS_BROWSER_MOCKS__: Object.getOwnPropertyDescriptor(window, "__ULTRA_RSS_BROWSER_MOCKS__"),
  };
}

function restoreDevMockWindowGlobal(name: DevMockWindowGlobalName, descriptor: PropertyDescriptor | undefined) {
  if (descriptor) {
    Object.defineProperty(window, name, descriptor);
    return;
  }

  delete window[name];
}

function setDevMockWindowGlobal(name: DevMockWindowGlobalName) {
  Object.defineProperty(window, name, {
    configurable: true,
    writable: true,
    value: true,
  });
}

function createDevMockWindowGlobalsRestore(snapshot: DevMockWindowGlobalsSnapshot): RestoreDevMocks {
  return () => {
    restoreDevMockWindowGlobal("__DEV_BROWSER_MOCKS__", snapshot.__DEV_BROWSER_MOCKS__);
    restoreDevMockWindowGlobal("__ULTRA_RSS_BROWSER_MOCKS__", snapshot.__ULTRA_RSS_BROWSER_MOCKS__);
  };
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
  resetDevMockDiagnostics();
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

function findLatestPublishedAt(articles: readonly ArticleDto[]): string | null {
  return articles.reduce<{ publishedAt: string | null; publishedTime: number }>(
    (latest, article) => {
      const publishedTime = Date.parse(article.published_at);
      if (!Number.isFinite(publishedTime)) {
        return latest;
      }

      const nextPublishedTime = Math.max(latest.publishedTime, publishedTime);
      if (nextPublishedTime === latest.publishedTime) {
        return latest;
      }

      return {
        publishedAt: article.published_at,
        publishedTime: nextPublishedTime,
      };
    },
    { publishedAt: null, publishedTime: Number.NEGATIVE_INFINITY },
  ).publishedAt;
}

export function setupDevMocks(): RestoreDevMocks {
  const restoreWindowGlobals = createDevMockWindowGlobalsRestore(captureDevMockWindowGlobals());

  if (window.__TAURI_INTERNALS__ && !window.__DEV_BROWSER_MOCKS__) return restoreWindowGlobals;
  resetDevMockState();
  setDevMockWindowGlobal("__DEV_BROWSER_MOCKS__");
  setDevMockWindowGlobal("__ULTRA_RSS_BROWSER_MOCKS__");

  const feedIntegrityReport = { orphaned_article_count: 0, orphaned_feeds: [] };

  console.info("[dev-mocks] Tauri not detected, injecting mock IPC with rich data for browser debugging");

  mockWindows("main");
  mockIPC(async (cmd, rawIpcPayload) => {
    switch (cmd) {
      case "list_accounts":
        return cloneMockResponse(mockAccounts);

      case "add_account": {
        const { kind, name, serverUrl } = parseBrowserMockArgs("add_account", rawIpcPayload);
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
        return cloneMockResponse(account);
      }

      case "update_account_sync": {
        const { accountId, syncIntervalSecs, syncOnStartup, syncOnWake, keepReadItemsDays } = parseBrowserMockArgs(
          "update_account_sync",
          rawIpcPayload,
        );
        const target = mockAccounts.find((a) => a.id === accountId);
        if (target) {
          target.sync_interval_secs = syncIntervalSecs;
          target.sync_on_startup = syncOnStartup;
          target.sync_on_wake = syncOnWake;
          target.keep_read_items_days = keepReadItemsDays;
        }
        return cloneMockResponse(target ?? null);
      }

      case "update_account_credentials": {
        const { accountId, serverUrl, username } = parseBrowserMockArgs("update_account_credentials", rawIpcPayload);
        const target = mockAccounts.find((a) => a.id === accountId);
        if (target) {
          target.server_url = serverUrl ?? target.server_url;
          target.username = username ?? target.username;
        }
        return cloneMockResponse(target ?? null);
      }

      case "rename_account": {
        const { accountId, name } = parseBrowserMockArgs("rename_account", rawIpcPayload);
        const target = mockAccounts.find((a) => a.id === accountId);
        if (target) {
          target.name = name;
        }
        return cloneMockResponse(target ?? null);
      }

      case "test_account_connection": {
        const { accountId } = parseBrowserMockArgs("test_account_connection", rawIpcPayload);
        return cloneMockResponse(mockAccounts.find((account) => account.id === accountId) ?? mockAccounts[0] ?? null);
      }

      case "delete_account": {
        const { accountId } = parseBrowserMockArgs("delete_account", rawIpcPayload);
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
        parseBrowserMockArgs("get_account_sync_status", rawIpcPayload);
        return {
          last_success_at: null,
          last_error: null,
          error_count: 0,
          next_retry_at: null,
        } satisfies AccountSyncStatusDto;

      case "list_folders": {
        const { accountId } = parseBrowserMockArgs("list_folders", rawIpcPayload);
        return cloneMockResponse(mockFolders.filter((f) => f.account_id === accountId));
      }

      case "create_folder": {
        const { accountId, name } = parseBrowserMockArgs("create_folder", rawIpcPayload);
        const folder: FolderDto = {
          id: `dev-folder-${nextFolderId++}`,
          account_id: accountId,
          name,
          sort_order: mockFolders.filter((f) => f.account_id === accountId).length,
        };
        mockFolders.push(folder);
        return cloneMockResponse(folder);
      }

      case "list_feeds": {
        const { accountId } = parseBrowserMockArgs("list_feeds", rawIpcPayload);
        return cloneMockResponse(mockFeeds.filter((f) => f.account_id === accountId));
      }

      case "add_local_feed": {
        const { accountId, url } = parseBrowserMockArgs("add_local_feed", rawIpcPayload);
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
        return cloneMockResponse(feed);
      }

      case "list_articles": {
        const {
          feedId,
          unreadOnly = false,
          starredOnly = false,
          offset = 0,
          limit = 50,
        } = parseBrowserMockArgs("list_articles", rawIpcPayload);
        const articles = mockArticles.filter(
          (article) =>
            article.feed_id === feedId && (!unreadOnly || !article.is_read) && (!starredOnly || article.is_starred),
        );
        return cloneMockResponse(applyMuteKeywordFilter(articles).slice(offset, offset + limit));
      }

      case "list_account_articles": {
        const {
          accountId,
          unreadOnly = false,
          offset = 0,
          limit = 50,
        } = parseBrowserMockArgs("list_account_articles", rawIpcPayload);
        const feedIds = new Set(mockFeeds.filter((f) => f.account_id === accountId).map((f) => f.id));
        const articles = mockArticles.filter((a) => feedIds.has(a.feed_id) && (!unreadOnly || !a.is_read));
        return cloneMockResponse(applyMuteKeywordFilter(articles).slice(offset, offset + limit));
      }

      case "list_feed_article_summaries": {
        const { accountId } = parseBrowserMockArgs("list_feed_article_summaries", rawIpcPayload);
        const visibleArticles = applyMuteKeywordFilter(mockArticles);
        return cloneMockResponse(
          mockFeeds
            .filter((feed) => feed.account_id === accountId)
            .map((feed) => {
              const feedArticles = visibleArticles.filter((article) => article.feed_id === feed.id);

              return {
                feed_id: feed.id,
                latest_article_at: findLatestPublishedAt(feedArticles),
                starred_count: feedArticles.filter((article) => article.is_starred).length,
              };
            }),
        );
      }

      case "list_folder_articles": {
        const {
          folderId,
          mode = "all",
          offset = 0,
          limit = 50,
        } = parseBrowserMockArgs("list_folder_articles", rawIpcPayload);
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
        return cloneMockResponse(applyMuteKeywordFilter(articles).slice(offset, offset + limit));
      }

      case "count_account_unread_articles": {
        const { accountId } = parseBrowserMockArgs("count_account_unread_articles", rawIpcPayload);
        return countUnreadByAccount(accountId);
      }

      case "count_account_starred_articles": {
        const { accountId } = parseBrowserMockArgs("count_account_starred_articles", rawIpcPayload);
        return countStarredByAccount(accountId);
      }

      case "mark_account_read": {
        const { accountId } = parseBrowserMockArgs("mark_account_read", rawIpcPayload);
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
        const { accountId } = parseBrowserMockArgs("mark_account_starred_read", rawIpcPayload);
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
        const { scopeKind, targetId, olderThanDays } = parseBrowserMockArgs("count_old_unread_articles", rawIpcPayload);
        return findOldUnreadArticles(scopeKind, targetId, olderThanDays).length;
      }

      case "mark_old_unread_read": {
        const { scopeKind, targetId, olderThanDays } = parseBrowserMockArgs("mark_old_unread_read", rawIpcPayload);
        const affectedFeedIds = new Set<string>();
        for (const article of findOldUnreadArticles(scopeKind, targetId, olderThanDays)) {
          article.is_read = true;
          affectedFeedIds.add(article.feed_id);
        }
        for (const feedId of affectedFeedIds) recalcUnread(feedId);
        return null;
      }

      case "unstar_account_articles": {
        const { accountId } = parseBrowserMockArgs("unstar_account_articles", rawIpcPayload);
        const feedIds = new Set(mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id));
        for (const article of mockArticles) {
          if (feedIds.has(article.feed_id)) {
            article.is_starred = false;
          }
        }
        return null;
      }

      case "list_starred_articles": {
        const { accountId } = parseBrowserMockArgs("list_starred_articles", rawIpcPayload);
        const feedIds = new Set(mockFeeds.filter((f) => f.account_id === accountId).map((f) => f.id));
        return cloneMockResponse(
          applyMuteKeywordFilter(mockArticles.filter((a) => feedIds.has(a.feed_id) && a.is_starred)),
        );
      }

      case "list_recent_articles": {
        const {
          accountId,
          mode = "all",
          offset = 0,
          limit = 20,
        } = parseBrowserMockArgs("list_recent_articles", rawIpcPayload);
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
        return cloneMockResponse(applyMuteKeywordFilter(articles).slice(offset, offset + limit));
      }

      case "get_feed_integrity_report":
        return cloneMockResponse(feedIntegrityReport);

      case "cleanup_feed_integrity_orphans": {
        const { dryRun } = parseBrowserMockArgs("cleanup_feed_integrity_orphans", rawIpcPayload);
        return {
          dry_run: dryRun,
          orphaned_article_count: feedIntegrityReport.orphaned_article_count,
          deleted_article_count: dryRun ? 0 : feedIntegrityReport.orphaned_article_count,
        };
      }

      case "search_articles": {
        const { accountId, query, offset = 0, limit = 50 } = parseBrowserMockArgs("search_articles", rawIpcPayload);
        const feedIds = new Set(mockFeeds.filter((feed) => feed.account_id === accountId).map((feed) => feed.id));
        const normalizedQuery = query.toLowerCase();
        const articles = mockArticles.filter(
          (article) => feedIds.has(article.feed_id) && article.title.toLowerCase().includes(normalizedQuery),
        );
        return cloneMockResponse(applyMuteKeywordFilter(articles).slice(offset, offset + limit));
      }

      case "list_mute_keywords":
        return cloneMockResponse([...mockMuteKeywords].sort((a, b) => b.created_at.localeCompare(a.created_at)));

      case "create_mute_keyword": {
        const { keyword, scope } = parseBrowserMockArgs("create_mute_keyword", rawIpcPayload);
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
        return cloneMockResponse(rule);
      }

      case "update_mute_keyword": {
        const { muteKeywordId, scope } = parseBrowserMockArgs("update_mute_keyword", rawIpcPayload);
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
        return cloneMockResponse(rule);
      }

      case "delete_mute_keyword": {
        const { muteKeywordId } = parseBrowserMockArgs("delete_mute_keyword", rawIpcPayload);
        const index = mockMuteKeywords.findIndex((rule) => rule.id === muteKeywordId);
        if (index >= 0) {
          mockMuteKeywords.splice(index, 1);
        }
        return null;
      }

      case "mark_article_read": {
        const { articleId, read } = parseBrowserMockArgs("mark_article_read", rawIpcPayload);
        const art = mockArticles.find((a) => a.id === articleId);
        if (art) {
          art.is_read = read ?? true;
          recalcUnread(art.feed_id);
        }
        return null;
      }

      case "record_article_view": {
        const { accountId, articleId } = parseBrowserMockArgs("record_article_view", rawIpcPayload);
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
        const { accountId } = parseBrowserMockArgs("clear_article_view_history", rawIpcPayload);
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
        const { articleIds } = parseBrowserMockArgs("mark_articles_read", rawIpcPayload);
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
        const { feedId } = parseBrowserMockArgs("mark_feed_read", rawIpcPayload);
        for (const art of mockArticles) {
          if (art.feed_id === feedId) art.is_read = true;
        }
        recalcUnread(feedId);
        return null;
      }

      case "mark_folder_read": {
        const { folderId } = parseBrowserMockArgs("mark_folder_read", rawIpcPayload);
        const folderFeedIds = new Set(mockFeeds.filter((f) => f.folder_id === folderId).map((f) => f.id));
        for (const art of mockArticles) {
          if (folderFeedIds.has(art.feed_id)) art.is_read = true;
        }
        for (const fid of folderFeedIds) recalcUnread(fid);
        return null;
      }

      case "toggle_article_star": {
        const { articleId, starred } = parseBrowserMockArgs("toggle_article_star", rawIpcPayload);
        const art = mockArticles.find((a) => a.id === articleId);
        if (art) art.is_starred = starred;
        return null;
      }

      case "get_preferences":
        return Object.fromEntries(mockPreferences);

      case "set_preference": {
        const { key, value } = parseBrowserMockArgs("set_preference", rawIpcPayload);
        mockPreferences.set(key, value);
        return null;
      }

      case "set_mute_auto_mark_read": {
        const { enabled } = parseBrowserMockArgs("set_mute_auto_mark_read", rawIpcPayload);
        mockPreferences.set("mute_auto_mark_read", String(enabled));
        return null;
      }

      case "get_platform_info":
        return cloneMockResponse(DEV_MOCK_PLATFORM_INFO);

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
        parseBrowserMockArgs("export_opml", rawIpcPayload);
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
        return cloneMockResponse(mockTags);

      case "create_tag": {
        const { name, color } = parseBrowserMockArgs("create_tag", rawIpcPayload);
        const tag: TagDto = {
          id: `dev-tag-${nextTagId++}`,
          name,
          color: color ?? null,
        };
        mockTags.push(tag);
        return cloneMockResponse(tag);
      }

      case "rename_tag": {
        const { tagId, name, color } = parseBrowserMockArgs("rename_tag", rawIpcPayload);
        const renameIdx = mockTags.findIndex((t) => t.id === tagId);
        if (renameIdx >= 0) {
          mockTags[renameIdx].name = name;
          mockTags[renameIdx].color = color ?? null;
          return cloneMockResponse(mockTags[renameIdx]);
        }
        throw { type: "UserVisible", message: "Tag not found" };
      }

      case "delete_tag": {
        const { tagId } = parseBrowserMockArgs("delete_tag", rawIpcPayload);
        const tagIdx = mockTags.findIndex((t) => t.id === tagId);
        if (tagIdx >= 0) mockTags.splice(tagIdx, 1);
        // Remove associated article_tags
        for (let i = mockArticleTags.length - 1; i >= 0; i--) {
          if (mockArticleTags[i].tag_id === tagId) mockArticleTags.splice(i, 1);
        }
        return null;
      }

      case "tag_article": {
        const { articleId, tagId } = parseBrowserMockArgs("tag_article", rawIpcPayload);
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
        const { articleId, tagId } = parseBrowserMockArgs("untag_article", rawIpcPayload);
        const atIdx = mockArticleTags.findIndex((at) => at.article_id === articleId && at.tag_id === tagId);
        if (atIdx >= 0) mockArticleTags.splice(atIdx, 1);
        return null;
      }

      case "get_article_tags": {
        const { articleId } = parseBrowserMockArgs("get_article_tags", rawIpcPayload);
        const tagIds = new Set(mockArticleTags.filter((at) => at.article_id === articleId).map((at) => at.tag_id));
        return cloneMockResponse(mockTags.filter((t) => tagIds.has(t.id)));
      }

      case "list_articles_by_tag": {
        const {
          tagId,
          accountId,
          mode = "all",
          offset = 0,
          limit = 50,
        } = parseBrowserMockArgs("list_articles_by_tag", rawIpcPayload);
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
        return cloneMockResponse(applyMuteKeywordFilter(filtered).slice(offset, offset + limit));
      }

      case "get_tag_article_counts": {
        const { accountId } = parseBrowserMockArgs("get_tag_article_counts", rawIpcPayload);
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
        const { url } = parseBrowserMockArgs("check_browser_embed_support", rawIpcPayload);
        try {
          const host = new URL(url).hostname;
          return !host.endsWith("note.com");
        } catch {
          return true;
        }
      }

      case "create_or_update_browser_webview": {
        const { url } = parseBrowserMockArgs("create_or_update_browser_webview", rawIpcPayload);
        return {
          url,
          can_go_back: false,
          can_go_forward: false,
          is_loading: false,
          load_generation: 1,
        };
      }

      case "set_browser_webview_bounds":
        parseBrowserMockArgs("set_browser_webview_bounds", rawIpcPayload);
        return null;

      case "focus_browser_webview":
        return null;

      case "delete_feed": {
        const { feedId } = parseBrowserMockArgs("delete_feed", rawIpcPayload);
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
        const { feedId, title } = parseBrowserMockArgs("rename_feed", rawIpcPayload);
        const feed = mockFeeds.find((f) => f.id === feedId);
        if (feed) feed.title = title;
        return null;
      }

      case "update_feed_folder": {
        const { feedId, folderId } = parseBrowserMockArgs("update_feed_folder", rawIpcPayload);
        const targetFeed = mockFeeds.find((f) => f.id === feedId);
        if (targetFeed) targetFeed.folder_id = folderId;
        return null;
      }

      case "update_feed_display_settings": {
        const { feedId, readerMode, webPreviewMode } = parseBrowserMockArgs(
          "update_feed_display_settings",
          rawIpcPayload,
        );
        const dmFeed = mockFeeds.find((f) => f.id === feedId);
        if (dmFeed) {
          dmFeed.reader_mode = readerMode;
          dmFeed.web_preview_mode = webPreviewMode;
        }
        return null;
      }

      case "discover_feeds": {
        const { url } = parseBrowserMockArgs("discover_feeds", rawIpcPayload);
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
        const { url } = parseBrowserMockArgs("open_in_browser", rawIpcPayload);
        window.open(url, "_blank");
        return null;
      }

      case "plugin:opener|open_url": {
        const { url } = parseBrowserMockArgs("plugin:opener|open_url", rawIpcPayload);
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
          load_generation: 1,
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
        parseBrowserMockArgs("trigger_startup_sync", rawIpcPayload);
        return {
          synced: true,
          total: 1,
          succeeded: 1,
          failed: [],
          warnings: [],
        };

      case "trigger_sync_account":
        parseBrowserMockArgs("trigger_sync_account", rawIpcPayload);
        return {
          synced: true,
          total: 1,
          succeeded: 1,
          failed: [],
          warnings: [],
        };

      case "trigger_sync_feed":
        parseBrowserMockArgs("trigger_sync_feed", rawIpcPayload);
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
        parseBrowserMockArgs("copy_to_clipboard", rawIpcPayload);
        return null;
      case "add_to_reading_list":
        parseBrowserMockArgs("add_to_reading_list", rawIpcPayload);
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
        throw recordDevMockUnknownCommand(cmd);
    }
  });

  return restoreWindowGlobals;
}
