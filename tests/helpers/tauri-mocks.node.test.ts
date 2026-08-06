import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Result } from "@praha/byethrow";
import { invoke } from "@tauri-apps/api/core";
import { nullable, parse } from "valibot";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  commandArgsSchemas,
  DatabaseInfoDtoSchema,
  FeedArticleSummaryDtoListSchema,
  FeedIntegrityCleanupDtoSchema,
  PreferencesDtoSchema,
  UpdateInfoDtoSchema,
} from "@/api/schemas";
import {
  checkForUpdate,
  cleanupFeedIntegrityOrphans,
  countAccountStarredArticles,
  countAccountUnreadArticles,
  getDatabaseInfo,
  getPlatformInfo,
  getPreferences,
  listAccountArticles,
  listAccounts,
  listArticles,
  listFeedArticleSummaries,
  listFeeds,
  listFolders,
  listRecentArticles,
  listStarredArticles,
  markArticleRead,
  markArticlesRead,
  toggleArticleStar,
} from "@/api/tauri-commands";
import { sampleAccounts, sampleArticles, sampleFeeds, sampleFolders } from "./fixtures";
import {
  createCommandIndex,
  extractCommandNames,
  extractSafeInvokeCommandsWithArgs,
  orderedCommandDifference,
} from "./tauri-command-contract";
import { readTauriCommandsSource } from "./tauri-command-source";
import { createTauriMockCallRecorder, mockPlatformInfo, setupTauriMocks, teardownTauriMocks } from "./tauri-mocks";

function readWorkspaceFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const INTENTIONALLY_UNHANDLED_DEFAULT_MOCK_COMMANDS = [
  "add_to_reading_list",
  "copy_to_clipboard",
  "create_folder",
  "delete_feed",
  "discover_feeds",
  "download_update",
  "export_opml_to_file",
  "export_settings_profile",
  "get_article_tags",
  "get_platform_permission_denied_recovery",
  "import_opml",
  "import_settings_profile",
  "list_articles_by_tag",
  "rename_account",
  "rename_feed",
  "restart_app",
  "tag_article",
  "untag_article",
  "update_account_credentials",
  "update_account_sync",
  "update_feed_display_settings",
  "update_feed_folder",
  "vacuum_database",
].toSorted();

function extractDefaultMockCommands(): string[] {
  return extractCommandNames(readWorkspaceFile("tests/helpers/tauri-mocks.ts"), /case "([^"]+)":/g);
}

function extractFrontendTauriCommands(): string[] {
  return extractCommandNames(readTauriCommandsSource(), /safeInvoke\(\s*"([^"]+)"/g);
}

function extractRustInvokeRegistryCommands(): string[] {
  const rustLib = readWorkspaceFile("src-tauri/src/lib.rs");
  const registry = rustLib.match(/\.invoke_handler\(tauri::generate_handler!\[\s*([\s\S]*?)\s*\]\)/)?.[1] ?? "";

  return extractCommandNames(registry, /commands::[a-z_]+::([a-zA-Z0-9_]+)/g);
}

describe("setupTauriMocks fixture isolation", () => {
  beforeEach(() => {
    setupTauriMocks();
  });

  afterEach(() => {
    teardownTauriMocks();
  });

  it("returns fresh account clones from default mocks", async () => {
    const accounts = Result.unwrap(await listAccounts());
    const account = accounts[0];
    const sampleAccount = sampleAccounts[0];

    expect(account?.capabilities).toBeDefined();
    expect(sampleAccount?.capabilities).toBeDefined();
    if (!account?.capabilities || !sampleAccount?.capabilities) {
      throw new Error("Expected account fixtures with capabilities");
    }

    account.name = "Dirty account";
    account.capabilities.supports_search = true;

    const nextAccounts = Result.unwrap(await listAccounts());

    expect(accounts).not.toBe(sampleAccounts);
    expect(account).not.toBe(sampleAccount);
    expect(account.capabilities).not.toBe(sampleAccount.capabilities);
    expect(nextAccounts).toEqual(sampleAccounts);
    expect(sampleAccount.name).toBe("Local");
    expect(sampleAccount.capabilities.supports_search).toBe(false);
  });

  it("returns fresh feed clones from default mocks", async () => {
    const feeds = Result.unwrap(await listFeeds("acc-1"));
    const feed = feeds[0];
    const accountFeeds = sampleFeeds.filter((candidate) => candidate.account_id === "acc-1");
    const sampleFeed = accountFeeds[0];

    expect(feed).toBeDefined();
    expect(sampleFeed).toBeDefined();
    if (!feed || !sampleFeed) {
      throw new Error("Expected feed fixtures");
    }

    feed.title = "Dirty feed";
    feed.unread_count = 999;

    const nextFeeds = Result.unwrap(await listFeeds("acc-1"));

    expect(feeds).not.toBe(accountFeeds);
    expect(feed).not.toBe(sampleFeed);
    expect(nextFeeds).toEqual(accountFeeds);
    expect(sampleFeed.title).toBe("Tech Blog");
    expect(sampleFeed.unread_count).toBe(5);
  });

  it("returns account-filtered fresh folder clones from default mocks", async () => {
    const folders = Result.unwrap(await listFolders("acc-2"));
    const folder = folders[0];
    const accountFolders = sampleFolders.filter((candidate) => candidate.account_id === "acc-2");
    const sampleFolder = accountFolders[0];

    expect(folder).toBeDefined();
    expect(sampleFolder).toBeDefined();
    if (!folder || !sampleFolder) {
      throw new Error("Expected folder fixtures");
    }

    folder.name = "Dirty folder";
    folder.sort_order = 999;

    const nextFolders = Result.unwrap(await listFolders("acc-2"));
    const otherAccountFolders = Result.unwrap(await listFolders("acc-1"));

    expect(folders).not.toBe(accountFolders);
    expect(folder).not.toBe(sampleFolder);
    expect(nextFolders).toEqual(accountFolders);
    expect(otherAccountFolders).toEqual([]);
    expect(sampleFolder.name).toBe("Reading");
    expect(sampleFolder.sort_order).toBe(0);
  });

  it("returns fresh article clones from default mocks", async () => {
    const articles = Result.unwrap(await listArticles("feed-1"));
    const article = articles[0];
    const sampleArticle = sampleArticles[0];

    expect(article).toBeDefined();
    expect(sampleArticle).toBeDefined();
    if (!article || !sampleArticle) {
      throw new Error("Expected article fixtures");
    }

    article.title = "Dirty article";
    article.is_read = true;

    const nextArticles = Result.unwrap(await listArticles("feed-1"));
    const feedArticles = sampleArticles.filter((sampleArticle) => sampleArticle.feed_id === "feed-1");

    expect(articles).not.toBe(sampleArticles);
    expect(article).not.toBe(sampleArticle);
    expect(nextArticles).toEqual(feedArticles);
    expect(sampleArticle.title).toBe("First Article");
    expect(sampleArticle.is_read).toBe(false);
  });

  it("applies command-schema pagination defaults to default article list mocks", async () => {
    expect(Result.unwrap(await listArticles("feed-1", 1, 1)).map((article) => article.id)).toEqual(["art-2"]);
    expect(Result.unwrap(await listAccountArticles("acc-1", 0, 1)).map((article) => article.id)).toEqual(["art-1"]);
    expect(Result.unwrap(await listStarredArticles("acc-1", 0, 1))?.map((article) => article.id)).toEqual(["art-2"]);
    expect(Result.unwrap(await listRecentArticles("acc-1", 1, 1)).map((article) => article.id)).toEqual(["art-1"]);
  });

  it("keeps article read and star mutation commands in the default mock fixture state", async () => {
    expect(Result.unwrap(await countAccountUnreadArticles("acc-1"))).toBe(1);
    expect(Result.unwrap(await countAccountStarredArticles("acc-1"))).toBe(1);

    Result.unwrap(await markArticleRead("art-1", true));
    expect(Result.unwrap(await listArticles("feed-1", true)).map((article) => article.id)).toEqual([]);
    expect(Result.unwrap(await countAccountUnreadArticles("acc-1"))).toBe(0);

    Result.unwrap(await toggleArticleStar("art-1", true));
    expect(Result.unwrap(await listStarredArticles("acc-1"))?.map((article) => article.id)).toEqual(["art-1", "art-2"]);
    expect(Result.unwrap(await countAccountStarredArticles("acc-1"))).toBe(2);

    Result.unwrap(await markArticlesRead(["art-2"]));
    expect(Result.unwrap(await listArticles("feed-1", true)).map((article) => article.id)).toEqual([]);
  });

  it("returns fresh platform info clones from default mocks", async () => {
    const platformInfo = Result.unwrap(await getPlatformInfo());

    platformInfo.kind = "macos";
    platformInfo.capabilities.supports_reading_list = true;

    const nextPlatformInfo = Result.unwrap(await getPlatformInfo());

    expect(platformInfo).not.toBe(mockPlatformInfo);
    expect(platformInfo.capabilities).not.toBe(mockPlatformInfo.capabilities);
    expect(nextPlatformInfo).toEqual(mockPlatformInfo);
    expect(mockPlatformInfo.kind).toBe("windows");
    expect(mockPlatformInfo.capabilities.supports_reading_list).toBe(false);
  });

  it("fails explicitly for unhandled commands", async () => {
    await expect(invoke("unknown_test_command")).rejects.toThrow("Unhandled Tauri mock command: unknown_test_command");
  });

  it("returns a schema-valid dry-run cleanup response from default mocks", async () => {
    const cleanup = Result.unwrap(await cleanupFeedIntegrityOrphans(true));

    expect(parse(FeedIntegrityCleanupDtoSchema, cleanup)).toEqual(cleanup);
    expect(cleanup).toEqual({
      dry_run: true,
      orphaned_article_count: 0,
      deleted_article_count: 0,
      orphaned_article_ids: [],
    });
  });

  it("returns schema-valid default responses for low-risk frontend commands", async () => {
    const feedSummaries = Result.unwrap(await listFeedArticleSummaries("acc-1"));
    const preferences = Result.unwrap(await getPreferences());
    const databaseInfo = Result.unwrap(await getDatabaseInfo());
    const updateInfo = Result.unwrap(await checkForUpdate());

    expect(parse(FeedArticleSummaryDtoListSchema, feedSummaries)).toEqual(feedSummaries);
    expect(parse(PreferencesDtoSchema, preferences)).toEqual(preferences);
    expect(parse(DatabaseInfoDtoSchema, databaseInfo)).toEqual(databaseInfo);
    expect(parse(nullable(UpdateInfoDtoSchema), updateInfo)).toEqual(updateInfo);
  });

  it("rejects invalid cleanup responses through the command response schema", async () => {
    teardownTauriMocks();
    setupTauriMocks((cmd) => {
      if (cmd === "cleanup_feed_integrity_orphans") {
        return {
          dry_run: true,
          orphaned_article_count: -1,
          deleted_article_count: 0,
        };
      }
      return undefined;
    });

    const result = await cleanupFeedIntegrityOrphans(true);

    const error = Result.unwrapError(result);
    expect(error.type).toBe("Diagnostics");
    expect(error.message).toBe("Response validation failed. See diagnostics for details.");
  });

  it("records Tauri mock calls while preserving custom handler overrides", async () => {
    teardownTauriMocks();
    const recorder = createTauriMockCallRecorder((cmd) => {
      if (cmd === "list_accounts") {
        return [];
      }
      return undefined;
    });
    setupTauriMocks(recorder.handler);

    expect(Result.unwrap(await listAccounts())).toEqual([]);
    expect(Result.unwrap(await listFeeds("acc-1"))).toEqual(sampleFeeds.filter((feed) => feed.account_id === "acc-1"));
    expect(recorder.calls).toEqual([
      { cmd: "list_accounts", args: {} },
      { cmd: "list_feeds", args: { accountId: "acc-1" } },
    ]);
  });

  it("records schema-validated args instead of raw IPC payloads before default fallback", async () => {
    teardownTauriMocks();
    const recorder = createTauriMockCallRecorder();
    setupTauriMocks(recorder.handler);

    await expect(invoke("list_feeds", { accountId: "acc-1", rawOnly: "not recorded" })).resolves.toEqual(
      sampleFeeds.filter((feed) => feed.account_id === "acc-1"),
    );

    expect(recorder.calls).toEqual([{ cmd: "list_feeds", args: { accountId: "acc-1" } }]);
  });

  it("validates args before invoking custom handlers or default fallback", async () => {
    teardownTauriMocks();
    const recorder = createTauriMockCallRecorder();
    setupTauriMocks(recorder.handler);

    await expect(invoke("list_feeds", { accountId: 42 })).rejects.toThrow();

    expect(recorder.calls).toEqual([]);
  });

  it("documents test IPC mock args parsing as an intentional fail-fast boundary", () => {
    const source = readWorkspaceFile("tests/helpers/tauri-mocks.ts");

    expect(source).toContain("Test IPC mocks fail fast so handlers never observe unvalidated command payloads.");
  });

  it("treats null, false, and zero custom handler responses as handled", async () => {
    teardownTauriMocks();
    setupTauriMocks((cmd) => {
      if (cmd === "custom_null_response") {
        return null;
      }
      if (cmd === "custom_false_response") {
        return false;
      }
      if (cmd === "custom_zero_response") {
        return 0;
      }
      return undefined;
    });

    await expect(invoke("custom_null_response")).resolves.toBeNull();
    await expect(invoke("custom_false_response")).resolves.toBe(false);
    await expect(invoke("custom_zero_response")).resolves.toBe(0);
  });

  it("falls back to default mocks only when the custom handler returns undefined", async () => {
    teardownTauriMocks();
    setupTauriMocks(() => undefined);

    expect(Result.unwrap(await listAccounts())).toEqual(sampleAccounts);
    await expect(invoke("unknown_test_command")).rejects.toThrow("Unhandled Tauri mock command: unknown_test_command");
  });

  it("documents default mock coverage for frontend Tauri commands", () => {
    const mockedCommands = extractDefaultMockCommands();
    const frontendCommands = extractFrontendTauriCommands();
    const mockedCommandIndex = createCommandIndex(mockedCommands);
    const frontendCommandIndex = createCommandIndex(frontendCommands);

    expect(orderedCommandDifference(frontendCommandIndex, mockedCommandIndex)).toEqual(
      INTENTIONALLY_UNHANDLED_DEFAULT_MOCK_COMMANDS,
    );
    expect(orderedCommandDifference(mockedCommandIndex, frontendCommandIndex)).toEqual([
      "plugin:event|listen",
      "plugin:event|unlisten",
      "plugin:window|is_always_on_top",
      "plugin:window|set_always_on_top",
      "plugin:window|set_badge_count",
      "plugin:window|set_icon",
    ]);
  });

  it("extracts command coverage with stable sorting and duplicate removal", () => {
    expect(
      extractCommandNames(
        `
          safeInvoke("zeta_command");
          safeInvoke("alpha_command");
          safeInvoke("zeta_command");
        `,
        /safeInvoke\(\s*"([^"]+)"/g,
      ),
    ).toEqual(["alpha_command", "zeta_command"]);
  });

  it("keeps intentionally unmocked frontend commands aligned with strict unhandled failures", async () => {
    await expect(invoke("export_opml_to_file", { accountId: "acc-1", path: "/tmp/feeds.opml" })).rejects.toThrow(
      "Unhandled Tauri mock command: export_opml_to_file",
    );
  });

  it("validates schema-covered intentionally unhandled commands before strict unhandled failures", async () => {
    await expect(invoke("rename_feed", { feedId: "   ", title: "Renamed" })).rejects.toThrow(
      "Command id must not be blank",
    );
    await expect(invoke("rename_feed", { feedId: "feed-1", title: "Renamed" })).rejects.toThrow(
      "Unhandled Tauri mock command: rename_feed",
    );
  });

  it("keeps intentionally unhandled default mock commands covered by args schemas or no-args exceptions", () => {
    const schemaCommands = createCommandIndex(Object.keys(commandArgsSchemas).toSorted());
    const unhandledCommands = createCommandIndex(INTENTIONALLY_UNHANDLED_DEFAULT_MOCK_COMMANDS);

    expect(orderedCommandDifference(unhandledCommands, schemaCommands)).toEqual([
      "download_update",
      "export_settings_profile",
      "get_platform_permission_denied_recovery",
      "restart_app",
      "vacuum_database",
    ]);
  });

  it("keeps command args schema registry aligned with frontend commands registered by Rust", () => {
    const rustRegistryCommands = new Set(extractRustInvokeRegistryCommands());
    const frontendCommandsWithArgs = extractSafeInvokeCommandsWithArgs(readTauriCommandsSource());
    const rustBackedFrontendCommandsWithArgs = frontendCommandsWithArgs.filter((command) =>
      rustRegistryCommands.has(command),
    );
    const schemaCommands = Object.keys(commandArgsSchemas)
      .filter((command) => command !== "plugin:opener|open_url")
      .toSorted();

    expect(
      orderedCommandDifference(
        createCommandIndex(schemaCommands),
        createCommandIndex(rustBackedFrontendCommandsWithArgs),
      ),
    ).toEqual([]);
    expect(
      orderedCommandDifference(
        createCommandIndex(rustBackedFrontendCommandsWithArgs),
        createCommandIndex(schemaCommands),
      ),
    ).toEqual([]);
  });
});
