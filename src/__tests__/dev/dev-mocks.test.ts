import { Result } from "@praha/byethrow";
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  countAccountStarredArticles,
  createOrUpdateBrowserWebview,
  getAccountSyncStatus,
  getDevRuntimeOptions,
  getFeedIntegrityReport,
  getPlatformInfo,
  listStarredArticles,
  testAccountConnection,
} from "@/api/tauri-commands";
import { setupDevMocks } from "@/dev/mocks";
import type { BrowserWebviewBounds } from "@/lib/browser/browser-webview";

describe("setupDevMocks", () => {
  const browserBounds: BrowserWebviewBounds = { x: 380, y: 48, width: 900, height: 720 };

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

  it("returns starred counts and articles in browser-only mode", async () => {
    setupDevMocks();

    const starredCount = Result.unwrap(await countAccountStarredArticles("acc-freshrss"));
    const starredArticles = Result.unwrap(await listStarredArticles("acc-freshrss"));

    expect(starredCount).toBe(2);
    expect(starredArticles).toHaveLength(2);
    expect(starredArticles[0]?.is_starred).toBe(true);
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
