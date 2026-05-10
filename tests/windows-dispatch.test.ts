import { describe, expect, it } from "vitest";

import { pickWindowsEnvOverrides, WINDOWS_DISPATCH_ENV_SCHEMA } from "../scripts/lib/windows-dispatch";

describe("Windows dispatch environment schema", () => {
  it("keeps forwarded environment variables schema-owned", () => {
    expect(WINDOWS_DISPATCH_ENV_SCHEMA).toEqual({
      DEV_CREDENTIALS: "devCredential",
      RUST_BACKTRACE: "passthrough",
      RUST_LOG: "passthrough",
      TAURI_DEV_PORT: "passthrough",
      VITE_DEV_INTENT: "passthrough",
      VITE_DEV_WEB_URL: "passthrough",
      VITE_DEV_WINDOW_HEIGHT: "passthrough",
      VITE_DEV_WINDOW_WIDTH: "passthrough",
      VITE_ULTRA_RSS_DEV_INTENT: "passthrough",
      VITE_ULTRA_RSS_DEV_WEB_URL: "passthrough",
    });
  });

  it("forwards only schema-allowed values and keeps future secrets out by default", () => {
    expect(
      pickWindowsEnvOverrides({
        DEV_CREDENTIALS: "1",
        FUTURE_TOKEN: "plain-token",
        RUST_LOG: "ultra_rss_reader=debug",
        TAURI_SIGNING_PRIVATE_KEY: "not-forwarded",
        VITE_DEV_WEB_URL: "https://example.test/article",
        VITE_DEV_WINDOW_HEIGHT: "720",
        VITE_DEV_WINDOW_WIDTH: "1280",
        VITE_ULTRA_RSS_DEV_INTENT: "open-reader",
        VITE_ULTRA_RSS_DEV_WEB_URL: "https://example.test/alias",
      }),
    ).toEqual({
      DEV_CREDENTIALS: "1",
      RUST_LOG: "ultra_rss_reader=debug",
      VITE_DEV_WEB_URL: "https://example.test/article",
      VITE_DEV_WINDOW_HEIGHT: "720",
      VITE_DEV_WINDOW_WIDTH: "1280",
      VITE_ULTRA_RSS_DEV_INTENT: "open-reader",
      VITE_ULTRA_RSS_DEV_WEB_URL: "https://example.test/alias",
    });
  });

  it("blocks secret-like values even when a passthrough key is schema-allowed", () => {
    expect(
      pickWindowsEnvOverrides({
        RUST_LOG: "github_pat_1234567890abcdef",
        VITE_DEV_INTENT: "open-subscriptions-index",
      }),
    ).toEqual({
      VITE_DEV_INTENT: "open-subscriptions-index",
    });
  });
});
