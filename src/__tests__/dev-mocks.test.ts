import { Result } from "@praha/byethrow";
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createOrUpdateBrowserWebview,
  getAccountSyncStatus,
  getDevRuntimeOptions,
  getFeedIntegrityReport,
  getPlatformInfo,
} from "@/api/tauri-commands";
import { setupDevMocks } from "@/dev-mocks";
import type { BrowserWebviewBounds } from "@/lib/browser-webview";

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

  it("returns a feed integrity report for browser-only feed cleanup checks", async () => {
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
      last_error: null,
      error_count: 0,
      next_retry_at: null,
    });
  });

  it("returns grouped broken references for the dedicated feed cleanup integrity intent", async () => {
    vi.stubEnv("VITE_DEV_INTENT", "open-feed-cleanup-broken-references");

    setupDevMocks();

    const result = await getFeedIntegrityReport();
    const report = Result.unwrap(result);

    expect(report).toEqual({
      orphaned_article_count: 3,
      orphaned_feeds: [
        {
          missing_feed_id: "ghost-feed-001",
          article_count: 2,
          latest_article_title: "Broken article from archived source",
          latest_article_published_at: "2026-03-29T12:00:00.000Z",
        },
        {
          missing_feed_id: "ghost-feed-002",
          article_count: 1,
          latest_article_title: "Another broken entry",
          latest_article_published_at: "2026-03-27T09:30:00.000Z",
        },
      ],
    });
  });
});
