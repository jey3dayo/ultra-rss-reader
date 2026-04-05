import { Result } from "@praha/byethrow";
import { clearMocks } from "@tauri-apps/api/mocks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOrUpdateBrowserWebview, getFeedIntegrityReport } from "@/api/tauri-commands";
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
    });
  });
});
