import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Result } from "@praha/byethrow";
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commandArgsSchemas } from "@/api/schemas";
import {
  addLocalFeed,
  countAccountStarredArticles,
  createOrUpdateBrowserWebview,
  createTag,
  getAccountSyncStatus,
  getDevRuntimeOptions,
  getFeedIntegrityReport,
  getPlatformInfo,
  getPreferences,
  listFeeds,
  listStarredArticles,
  setPreference,
  testAccountConnection,
  updateAccountCredentials,
} from "@/api/tauri-commands";
import { setupDevMocks } from "@/dev/mocks";
import type { BrowserWebviewBounds } from "@/lib/browser/browser-webview";

describe("setupDevMocks", () => {
  const browserBounds: BrowserWebviewBounds = {
    x: 380,
    y: 48,
    width: 900,
    height: 720,
  };

  beforeEach(() => {
    clearMocks();
    delete window.__TAURI_INTERNALS__;
  });

  afterEach(() => {
    clearMocks();
    vi.unstubAllEnvs();
  });

  it("returns a settled browser state for browser-only UI checks", async () => {
    setupDevMocks();

    const result = await createOrUpdateBrowserWebview("https://example.com/article", browserBounds);
    const state = Result.unwrap(result);

    expect(state).toEqual({
      url: "https://example.com/article",
      can_go_back: false,
      can_go_forward: false,
      is_loading: false,
    });
  });

  it("returns an empty feed integrity report for browser-only subscription checks", async () => {
    setupDevMocks();

    const result = await getFeedIntegrityReport();
    const report = Result.unwrap(result);

    expect(report).toEqual({
      orphaned_article_count: 0,
      orphaned_feeds: [],
    });
  });

  it("returns dev runtime options instead of null in browser-only mode", async () => {
    setupDevMocks();

    const result = await getDevRuntimeOptions();
    const options = Result.unwrap(result);

    expect(options).toEqual({
      dev_intent: null,
      dev_web_url: null,
      dev_window_width: null,
      dev_window_height: null,
    });
  });

  it("reports an unknown platform in browser-only preview mode", async () => {
    setupDevMocks();

    const result = await getPlatformInfo();
    const platform = Result.unwrap(result);

    expect(platform.kind).toBe("unknown");
  });

  it("returns account sync status for browser-only account settings checks", async () => {
    setupDevMocks();

    const result = await getAccountSyncStatus("acc-1");
    const status = Result.unwrap(result);

    expect(status).toEqual({
      last_success_at: null,
      last_error: null,
      error_count: 0,
      next_retry_at: null,
    });
  });

  it("returns the requested account for browser-only connection checks", async () => {
    setupDevMocks();

    const account = Result.unwrap(await testAccountConnection("acc-local"));

    expect(account.id).toBe("acc-local");
  });

  it("updates account credential fields in browser-only mode", async () => {
    setupDevMocks();

    const account = Result.unwrap(
      await updateAccountCredentials("acc-freshrss", "https://reader.example.com", "demo-user", "secret"),
    );

    expect(account.id).toBe("acc-freshrss");
    expect(account.server_url).toBe("https://reader.example.com");
    expect(account.username).toBe("demo-user");
  });

  it("returns starred counts and articles in browser-only mode", async () => {
    setupDevMocks();

    const starredCount = Result.unwrap(await countAccountStarredArticles("acc-freshrss"));
    const starredArticles = Result.unwrap(await listStarredArticles("acc-freshrss"));

    expect(starredCount).toBe(2);
    expect(starredArticles).toHaveLength(2);
    expect(starredArticles[0]?.is_starred).toBe(true);
  });

  it("resets mutable browser-only mock state on each setup", async () => {
    setupDevMocks();

    const firstFeed = Result.unwrap(await addLocalFeed("acc-local", "https://stateful.example.com/feed.xml"));
    const firstTag = Result.unwrap(await createTag("stateful"));
    Result.unwrap(await setPreference("reader_mode_default", "false"));

    expect(firstFeed.id).toBe("dev-feed-100");
    expect(firstTag.id).toBe("dev-tag-100");
    expect(Result.unwrap(await getPreferences()).reader_mode_default).toBe("false");
    expect(Result.unwrap(await listFeeds("acc-local")).some((feed) => feed.id === firstFeed.id)).toBe(true);

    setupDevMocks();

    expect(Result.unwrap(await listFeeds("acc-local")).some((feed) => feed.id === firstFeed.id)).toBe(false);

    const secondFeed = Result.unwrap(await addLocalFeed("acc-local", "https://stateful.example.com/feed.xml"));
    const secondTag = Result.unwrap(await createTag("stateful"));

    expect(secondFeed.id).toBe("dev-feed-100");
    expect(secondTag.id).toBe("dev-tag-100");
    expect(Result.unwrap(await getPreferences())).toEqual({});
    expect(Result.unwrap(await listFeeds("acc-local")).filter((feed) => feed.id === firstFeed.id)).toHaveLength(1);
  });

  it("keeps every schema-validated command covered by the browser-only mock switch", () => {
    const source = readFileSync(resolve(process.cwd(), "src/dev/mocks.ts"), "utf8");
    const mockedCommands = new Set([...source.matchAll(/case "([^"]+)"/g)].map((match) => match[1]));

    expect(Object.keys(commandArgsSchemas).filter((command) => !mockedCommands.has(command))).toEqual([]);
  });

  it("returns an empty integrity report in browser-only mode", async () => {
    setupDevMocks();

    const result = await getFeedIntegrityReport();
    const report = Result.unwrap(result);

    expect(report).toEqual({
      orphaned_article_count: 0,
      orphaned_feeds: [],
    });
  });
});
