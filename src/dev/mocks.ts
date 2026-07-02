/**
 * Development mock for running outside Tauri (browser-only mode).
 * Automatically injects mockIPC when window.__TAURI_INTERNALS__ is not available.
 */

import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { type CommandArgsSchemaRegistry, commandArgsSchemas, SettingsProfileSchema } from "@/api/schemas";
import type {
  AccountDto,
  AccountSyncStatusDto,
  ArticleDto,
  FeedArticleSummaryDto,
  FeedDto,
  FolderDto,
  MuteKeywordDto,
  TagDto,
} from "@/api/tauri-commands";
import { DEFAULT_PLATFORM_INFO } from "@/constants/platform";
import { readDevIntent, readDevWebUrl, readDevWindowSize } from "@/dev/intent";
import { mockAccounts, mockArticles, mockArticleTags, mockFeeds, mockFolders, mockTags } from "@/dev/mock-data";
import {
  captureDevMockWindowGlobals,
  createDevMockWindowGlobalsRestore,
  defineDevMockWindowGlobal,
  type RestoreDevMocks,
  recordDevMockExternalOpen,
  recordDevMockUnknownCommand,
  resetDevMockDiagnostics,
  resetDevMockExternalOpens,
  setDevMockWindowGlobal,
} from "@/dev/mock-runtime";
import {
  applyMuteKeywordFilter,
  collectFeedIdsByAccount,
  collectFeedIdsByFolder,
  countStarredByAccount,
  countUnreadByAccount,
  deleteDevMockAccount,
  findLatestPublishedAt,
  findOldUnreadArticles,
  mockArticleViewHistory,
  mockMuteKeywords,
  mockPreferences,
  recalcUnread,
  resetDevMockDataState,
  takeNextDevMockAccountId,
  takeNextDevMockFeedId,
  takeNextDevMockFolderId,
  takeNextDevMockMuteKeywordId,
  takeNextDevMockTagId,
  titleFromUrl,
} from "@/dev/mock-state";
import { addHours, getCurrentDate, getCurrentIsoTimestamp, toIsoTimestamp } from "@/lib/datetime";
import type { RuntimeSchema, SchemaOutput } from "@/schemas/parse";

export const DEV_MOCK_PLATFORM_INFO = DEFAULT_PLATFORM_INFO;
export const DEV_MOCK_NETWORK_BOUNDARY = {
  externalOpen: "record-only",
  browserWebview: "state-only",
  feedDiscovery: "synthetic",
} as const;
export const DEV_MOCK_SIDE_EFFECT_BOUNDARY = {
  externalOpen: "record-only",
  readingList: "record-only",
  browserWebview: "state-only",
  feedIntegrityCleanup: "dry-run-safe",
  opmlImport: "explicitly-unsupported",
} as const;

type MockCommandArgsSchema = RuntimeSchema<Record<string, unknown>>;
const browserMockCommandArgsSchemas: CommandArgsSchemaRegistry = commandArgsSchemas satisfies Record<
  string,
  MockCommandArgsSchema
>;
type BrowserMockCommandArgsSchemas = CommandArgsSchemaRegistry;
type MockCommandWithArgs = keyof BrowserMockCommandArgsSchemas;
type ParsedBrowserMockArgs<TCommand extends MockCommandWithArgs> = SchemaOutput<
  BrowserMockCommandArgsSchemas[TCommand]
>;
type RawMockIpcPayload = unknown;

type DevSettingsProfile = ReturnType<typeof SettingsProfileSchema.parse>;
type DevLocalSyncSettings = {
  account_id: string;
  sync_folder_path: string;
  sync_account_id: string;
  device_id: string;
  enabled: boolean;
};

const mockLocalSyncSettings = new Map<string, DevLocalSyncSettings>();

export type { RestoreDevMocks } from "@/dev/mock-runtime";

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

function resetDevMockState() {
  resetDevMockDataState();
  resetDevMockDiagnostics();
  resetDevMockExternalOpens();
  mockLocalSyncSettings.clear();
}

function normalizeSettingsProfileServerUrl(serverUrl: string | null): string | null {
  if (!serverUrl) return null;
  try {
    const url = new URL(serverUrl.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function importSettingsProfileIntoDevMocks(profile: DevSettingsProfile) {
  const accountIdMap = new Map<string, string>();
  let accountsCreated = 0;
  let accountsUpdated = 0;
  let preferencesImported = 0;
  let preferencesSkipped = 0;
  let tagsCreated = 0;
  let tagsUpdated = 0;
  let muteKeywordsCreated = 0;
  let muteKeywordsSkipped = 0;

  for (const profileAccount of profile.accounts) {
    const normalizedServerUrl =
      profileAccount.kind === "FreshRss" ? normalizeSettingsProfileServerUrl(profileAccount.server_url) : null;
    const username = profileAccount.kind === "FreshRss" ? profileAccount.username?.trim() || null : null;
    if (profileAccount.kind === "FreshRss" && (!normalizedServerUrl || !username)) {
      throw new Error("FreshRSS account profile requires a valid server_url and username.");
    }
    const matchingAccount = mockAccounts.find((account) => {
      if (profileAccount.kind === "Local") {
        return account.kind === "Local" && account.name.toLowerCase() === profileAccount.name.toLowerCase();
      }
      return (
        account.kind === "FreshRss" &&
        normalizeSettingsProfileServerUrl(account.server_url) === normalizedServerUrl &&
        account.username === username
      );
    });
    const conflictingAccount = mockAccounts.find(
      (account) =>
        account.name.toLowerCase() === profileAccount.name.toLowerCase() &&
        (!matchingAccount || account.id !== matchingAccount.id),
    );
    if (conflictingAccount) {
      throw new Error(`Account name "${profileAccount.name}" already exists.`);
    }
    if (matchingAccount) {
      matchingAccount.name = profileAccount.name;
      matchingAccount.server_url = normalizedServerUrl;
      matchingAccount.username = username;
      matchingAccount.sync_interval_secs = profileAccount.sync_interval_secs;
      matchingAccount.sync_on_startup = profileAccount.sync_on_startup;
      matchingAccount.sync_on_wake = profileAccount.sync_on_wake;
      matchingAccount.keep_read_items_days = profileAccount.keep_read_items_days;
      matchingAccount.connection_verification_status = "unverified";
      matchingAccount.connection_verified_at = null;
      matchingAccount.connection_verification_error = null;
      accountIdMap.set(profileAccount.source_id, matchingAccount.id);
      accountsUpdated++;
    } else {
      const account: AccountDto = {
        id: `acc-profile-${mockAccounts.length + accountsCreated + 1}`,
        kind: profileAccount.kind,
        name: profileAccount.name,
        server_url: normalizedServerUrl,
        username,
        sync_interval_secs: profileAccount.sync_interval_secs,
        sync_on_startup: profileAccount.sync_on_startup,
        sync_on_wake: profileAccount.sync_on_wake,
        keep_read_items_days: profileAccount.keep_read_items_days,
        connection_verification_status: "unverified",
        connection_verified_at: null,
        connection_verification_error: null,
      };
      mockAccounts.push(account);
      accountIdMap.set(profileAccount.source_id, account.id);
      accountsCreated++;
    }
  }

  for (const [key, profileValue] of Object.entries(profile.preferences)) {
    const value = key === "selected_account_id" ? accountIdMap.get(profileValue) : profileValue;
    if (value == null) {
      preferencesSkipped++;
      continue;
    }
    mockPreferences.set(key, value);
    preferencesImported++;
  }

  for (const profileTag of profile.tags) {
    const tagName = profileTag.name.trim();
    const existingTag = mockTags.find((tag) => tag.name.toLowerCase() === tagName.toLowerCase());
    if (existingTag) {
      existingTag.name = tagName;
      existingTag.color = profileTag.color;
      tagsUpdated++;
    } else {
      mockTags.push({ id: `dev-tag-${takeNextDevMockTagId()}`, name: tagName, color: profileTag.color });
      tagsCreated++;
    }
  }

  const muteKeywordIdentity = (keyword: string, scope: string) => `${keyword.trim().toLowerCase()}\u0000${scope}`;
  const existingMuteKeywordIdentities = new Set(
    mockMuteKeywords.map((rule) => muteKeywordIdentity(rule.keyword, rule.scope)),
  );
  for (const profileRule of profile.mute_keywords) {
    const keyword = profileRule.keyword.trim();
    const identity = muteKeywordIdentity(keyword, profileRule.scope);
    if (existingMuteKeywordIdentities.has(identity)) {
      muteKeywordsSkipped++;
      continue;
    }
    const timestamp = getCurrentIsoTimestamp();
    mockMuteKeywords.unshift({
      id: `dev-mute-${takeNextDevMockMuteKeywordId()}`,
      keyword,
      scope: profileRule.scope,
      created_at: timestamp,
      updated_at: timestamp,
    });
    existingMuteKeywordIdentities.add(identity);
    muteKeywordsCreated++;
  }

  return {
    accounts_created: accountsCreated,
    accounts_updated: accountsUpdated,
    preferences_imported: preferencesImported,
    preferences_skipped: preferencesSkipped,
    tags_created: tagsCreated,
    tags_updated: tagsUpdated,
    mute_keywords_created: muteKeywordsCreated,
    mute_keywords_skipped: muteKeywordsSkipped,
  };
}

export function setupDevMocks(): RestoreDevMocks {
  const restoreWindowGlobals = createDevMockWindowGlobalsRestore(captureDevMockWindowGlobals());

  if (window.__TAURI_INTERNALS__ && !window.__DEV_BROWSER_MOCKS__ && !window.__ULTRA_RSS_BROWSER_MOCKS__) {
    defineDevMockWindowGlobal("__DEV_BROWSER_MOCKS__", false);
    defineDevMockWindowGlobal("__ULTRA_RSS_BROWSER_MOCKS__", false);
  }
  if (window.__TAURI_INTERNALS__ && !window.__DEV_BROWSER_MOCKS__) return restoreWindowGlobals;

  resetDevMockState();
  setDevMockWindowGlobal("__DEV_BROWSER_MOCKS__");
  setDevMockWindowGlobal("__ULTRA_RSS_BROWSER_MOCKS__");

  const feedIntegrityReport = { orphaned_article_count: 0, orphaned_feeds: [] };

  console.info("[dev-mocks] Tauri not detected, injecting mock IPC with rich data for browser debugging");

  mockWindows("main");
  mockIPC(async (cmd, rawIpcPayload) => {
    switch (cmd) {
      case "plugin:window|set_badge_count":
        return null;

      case "list_accounts":
        return cloneMockResponse(mockAccounts);

      case "add_account": {
        const { kind, name, serverUrl } = parseBrowserMockArgs("add_account", rawIpcPayload);
        const account: AccountDto = {
          id: `dev-acc-${takeNextDevMockAccountId()}`,
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
        deleteDevMockAccount(accountId);
        return null;
      }

      case "get_account_sync_status": {
        const { accountId } = parseBrowserMockArgs("get_account_sync_status", rawIpcPayload);
        const account = mockAccounts.find((item) => item.id === accountId);
        if (!account) {
          return {
            last_success_at: null,
            last_error: `Account not found: ${accountId}`,
            error_count: 1,
            next_retry_at: null,
          } satisfies AccountSyncStatusDto;
        }
        if (account.kind === "Local") {
          return {
            last_success_at: null,
            last_error: "Sync is unavailable for local accounts",
            error_count: 1,
            next_retry_at: null,
          } satisfies AccountSyncStatusDto;
        }
        return {
          last_success_at: null,
          last_error: null,
          error_count: 0,
          next_retry_at: null,
        } satisfies AccountSyncStatusDto;
      }

      case "list_folders": {
        const { accountId } = parseBrowserMockArgs("list_folders", rawIpcPayload);
        return cloneMockResponse(mockFolders.filter((f) => f.account_id === accountId));
      }

      case "create_folder": {
        const { accountId, name } = parseBrowserMockArgs("create_folder", rawIpcPayload);
        const folder: FolderDto = {
          id: `dev-folder-${takeNextDevMockFolderId()}`,
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
        const feedId = `dev-feed-${takeNextDevMockFeedId()}`;
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

      case "get_article": {
        const { articleId } = parseBrowserMockArgs("get_article", rawIpcPayload);
        const article = mockArticles.find((candidate) => candidate.id === articleId) ?? mockArticles[0];
        return cloneMockResponse(article);
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
        const feedIds = collectFeedIdsByAccount(accountId);
        const articles = mockArticles.filter((a) => feedIds.has(a.feed_id) && (!unreadOnly || !a.is_read));
        return cloneMockResponse(applyMuteKeywordFilter(articles).slice(offset, offset + limit));
      }

      case "list_feed_article_summaries": {
        const { accountId } = parseBrowserMockArgs("list_feed_article_summaries", rawIpcPayload);
        const visibleArticles = applyMuteKeywordFilter(mockArticles);
        const summaries: FeedArticleSummaryDto[] = [];
        for (const feed of mockFeeds) {
          if (feed.account_id !== accountId) {
            continue;
          }

          const feedArticles = visibleArticles.filter((article) => article.feed_id === feed.id);
          summaries.push({
            feed_id: feed.id,
            latest_article_at: findLatestPublishedAt(feedArticles),
            starred_count: feedArticles.filter((article) => article.is_starred).length,
          });
        }
        return cloneMockResponse(summaries);
      }

      case "list_folder_articles": {
        const {
          folderId,
          mode = "all",
          offset = 0,
          limit = 50,
        } = parseBrowserMockArgs("list_folder_articles", rawIpcPayload);
        const feedIds = collectFeedIdsByFolder(folderId);
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
        const feedIds = collectFeedIdsByAccount(accountId);
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
        const feedIds = collectFeedIdsByAccount(accountId);
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
        const feedIds = new Set<string>();
        for (const feed of mockFeeds) {
          if (feed.account_id === accountId) {
            feedIds.add(feed.id);
          }
        }
        for (const article of mockArticles) {
          if (feedIds.has(article.feed_id)) {
            article.is_starred = false;
          }
        }
        return null;
      }

      case "list_starred_articles": {
        const { accountId } = parseBrowserMockArgs("list_starred_articles", rawIpcPayload);
        const feedIds = collectFeedIdsByAccount(accountId);
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
        const feedIds = collectFeedIdsByAccount(accountId);
        const articleById = new Map(mockArticles.map((article) => [article.id, article]));
        const articles: ArticleDto[] = [];
        for (const item of mockArticleViewHistory) {
          if (item.accountId !== accountId) {
            continue;
          }

          const article = articleById.get(item.articleId);
          if (!article || !feedIds.has(article.feed_id)) {
            continue;
          }
          if (mode === "unread" && article.is_read) {
            continue;
          }
          if (mode === "starred" && !article.is_starred) {
            continue;
          }

          articles.push({ ...article, viewed_at: item.viewedAt });
        }
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
          ...(dryRun ? { orphaned_article_ids: [] } : {}),
        };
      }

      case "search_articles": {
        const { accountId, query, offset = 0, limit = 50 } = parseBrowserMockArgs("search_articles", rawIpcPayload);
        const feedIds = collectFeedIdsByAccount(accountId);
        const normalizedQuery = query.toLowerCase();
        const articles = mockArticles.filter(
          (article) => feedIds.has(article.feed_id) && article.title.toLowerCase().includes(normalizedQuery),
        );
        return cloneMockResponse(applyMuteKeywordFilter(articles).slice(offset, offset + limit));
      }

      case "list_mute_keywords":
        return cloneMockResponse(mockMuteKeywords.toSorted((a, b) => b.created_at.localeCompare(a.created_at)));

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
          id: `dev-mute-${takeNextDevMockMuteKeywordId()}`,
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
        const feedIds = collectFeedIdsByAccount(accountId);
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
        const folderFeedIds = new Set<string>();
        for (const feed of mockFeeds) {
          if (feed.folder_id === folderId) {
            folderFeedIds.add(feed.id);
          }
        }
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

      case "get_local_account_sync_settings": {
        const { accountId } = parseBrowserMockArgs("get_local_account_sync_settings", rawIpcPayload);
        return mockLocalSyncSettings.get(accountId) ?? null;
      }

      case "set_local_account_sync_settings": {
        const { accountId, syncFolderPath, enabled } = parseBrowserMockArgs(
          "set_local_account_sync_settings",
          rawIpcPayload,
        );
        const existing = mockLocalSyncSettings.get(accountId);
        const settings = {
          account_id: accountId,
          sync_folder_path: syncFolderPath,
          sync_account_id: existing?.sync_account_id ?? `dev-sync-${accountId}`,
          device_id: existing?.device_id ?? "dev-device",
          enabled,
        };
        mockLocalSyncSettings.set(accountId, settings);
        return settings;
      }

      case "export_local_account_sync_operations": {
        parseBrowserMockArgs("export_local_account_sync_operations", rawIpcPayload);
        return { operations_written: 0 };
      }

      case "import_local_account_sync_operations": {
        parseBrowserMockArgs("import_local_account_sync_operations", rawIpcPayload);
        return {
          loaded_operations: 0,
          applied_operations: 0,
          rejected_operations: 0,
          rejected_files: 0,
          conflicted_candidates: 0,
          applied: true,
          folders_upserted: 0,
          feeds_upserted: 0,
          article_states_applied: 0,
          tags_upserted: 0,
          article_tags_added: 0,
          article_tags_removed: 0,
          mute_keywords_upserted: 0,
          mute_keywords_removed: 0,
          unmatched_article_keys: 0,
          skipped_removed_tags: 0,
          conflict_count: 0,
        };
      }

      case "export_settings_profile":
        return JSON.stringify(
          {
            version: 1,
            exported_at: new Date().toISOString(),
            content_type: "application/vnd.ultra-rss-reader.settings-profile+json",
            preferences: Object.fromEntries(mockPreferences),
            accounts: mockAccounts.map((account) => ({
              source_id: account.id,
              kind: account.kind,
              name: account.name,
              server_url: account.server_url,
              username: account.username,
              sync_interval_secs: account.sync_interval_secs,
              sync_on_startup: account.sync_on_startup,
              sync_on_wake: account.sync_on_wake,
              keep_read_items_days: account.keep_read_items_days,
            })),
            tags: mockTags.map((tag) => ({
              name: tag.name,
              color: tag.color,
            })),
            mute_keywords: mockMuteKeywords.map((rule) => ({
              keyword: rule.keyword,
              scope: rule.scope,
            })),
          },
          null,
          2,
        );

      case "export_settings_profile_to_file":
        parseBrowserMockArgs("export_settings_profile_to_file", rawIpcPayload);
        return null;

      case "import_settings_profile": {
        const { profileJson } = parseBrowserMockArgs("import_settings_profile", rawIpcPayload);
        return importSettingsProfileIntoDevMocks(SettingsProfileSchema.parse(JSON.parse(profileJson)));
      }

      case "set_mute_auto_mark_read": {
        const { enabled } = parseBrowserMockArgs("set_mute_auto_mark_read", rawIpcPayload);
        mockPreferences.set("mute_auto_mark_read", String(enabled));
        return null;
      }

      case "get_platform_info":
        return cloneMockResponse(DEV_MOCK_PLATFORM_INFO);

      case "get_platform_permission_denied_recovery":
        return [
          {
            surface: "file",
            user_action_copy: "Grant file access in System Settings, then retry the operation.",
          },
          {
            surface: "dialog",
            user_action_copy: "Allow dialog access when macOS prompts, then retry the operation.",
          },
          {
            surface: "keyring",
            user_action_copy: "Unlock the system keychain or restore keychain access, then retry the operation.",
          },
          {
            surface: "clipboard",
            user_action_copy: "Allow clipboard access when macOS prompts, then retry the operation.",
          },
        ];

      case "reset_oversized_dev_credentials_store":
        return false;

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
          id: `dev-tag-${takeNextDevMockTagId()}`,
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
        const tagIds = new Set<string>();
        for (const articleTag of mockArticleTags) {
          if (articleTag.article_id === articleId) {
            tagIds.add(articleTag.tag_id);
          }
        }
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
        const articleIds = new Set<string>();
        for (const articleTag of mockArticleTags) {
          if (articleTag.tag_id === tagId) {
            articleIds.add(articleTag.article_id);
          }
        }
        let filtered = mockArticles.filter((a) => articleIds.has(a.id));
        if (accountId) {
          const feedIds = collectFeedIdsByAccount(accountId);
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
        if (!targetFeed) {
          throw { type: "UserVisible", message: "Feed not found" };
        }
        const targetFolder = folderId ? mockFolders.find((folder) => folder.id === folderId) : null;
        if (folderId && !targetFolder) {
          throw { type: "UserVisible", message: "Folder not found" };
        }
        if (targetFolder && targetFolder.account_id !== targetFeed.account_id) {
          throw {
            type: "UserVisible",
            message: "Folder belongs to another account",
          };
        }
        targetFeed.folder_id = folderId;
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
        recordDevMockExternalOpen({
          command: "open_in_browser",
          url,
          target: "_blank",
        });
        return null;
      }

      case "plugin:opener|open_url": {
        const { url } = parseBrowserMockArgs("plugin:opener|open_url", rawIpcPayload);
        recordDevMockExternalOpen({
          command: "plugin:opener|open_url",
          url,
          target: "_blank",
        });
        return null;
      }

      case "plugin:event|listen":
        return 1;

      case "plugin:event|unlisten":
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
        parseBrowserMockArgs("import_opml", rawIpcPayload);
        throw {
          type: "UserVisible",
          message: "Browser-only dev mocks do not import OPML because it would create feeds.",
        };
      case "copy_to_clipboard":
        parseBrowserMockArgs("copy_to_clipboard", rawIpcPayload);
        return null;
      case "add_to_reading_list":
        {
          const { url } = parseBrowserMockArgs("add_to_reading_list", rawIpcPayload);
          recordDevMockExternalOpen({
            command: "add_to_reading_list",
            url,
            target: "reading-list",
          });
        }
        return null;
      case "get_database_info":
        return {
          db_size_bytes: 2_500_000,
          wal_size_bytes: 150_000,
          shm_size_bytes: 32_768,
          total_size_bytes: 2_682_768,
        };
      case "vacuum_database":
        return {
          db_size_bytes: 2_100_000,
          wal_size_bytes: 0,
          shm_size_bytes: 32_768,
          total_size_bytes: 2_132_768,
        };
      case "backup_database":
        return null;
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
