import { afterEach, describe, expect, it, vi } from "vitest";
import { parseDevIntent, readDevIntent, readDevWebUrl, readDevWindowSize } from "@/lib/dev-intent";

describe("dev-intent helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses known dev scenario ids", () => {
    expect(parseDevIntent("open-add-feed-dialog")).toBe("open-add-feed-dialog");
    expect(parseDevIntent("open-command-palette")).toBe("open-command-palette");
    expect(parseDevIntent("open-feed-cleanup")).toBe("open-feed-cleanup");
    expect(parseDevIntent("open-feed-cleanup-broken-references")).toBe("open-feed-cleanup-broken-references");
    expect(parseDevIntent("open-shortcuts-help")).toBe("open-shortcuts-help");
    expect(parseDevIntent("open-settings-actions")).toBe("open-settings-actions");
    expect(parseDevIntent("open-settings-accounts")).toBe("open-settings-accounts");
    expect(parseDevIntent("open-settings-appearance")).toBe("open-settings-appearance");
    expect(parseDevIntent("open-subscriptions-index")).toBe("open-subscriptions-index");
    expect(parseDevIntent("open-settings-data")).toBe("open-settings-data");
    expect(parseDevIntent("open-settings-debug")).toBe("open-settings-debug");
    expect(parseDevIntent("open-settings-general")).toBe("open-settings-general");
    expect(parseDevIntent("open-settings-mute")).toBe("open-settings-mute");
    expect(parseDevIntent("open-web-preview-url")).toBe("open-web-preview-url");
    expect(parseDevIntent("open-settings-reading")).toBe("open-settings-reading");
    expect(parseDevIntent("open-settings-accounts-add")).toBe("open-settings-accounts-add");
    expect(parseDevIntent("open-settings-shortcuts")).toBe("open-settings-shortcuts");
    expect(parseDevIntent("open-settings-tags")).toBe("open-settings-tags");
    expect(parseDevIntent("open-settings-reading-display-mode")).toBe("open-settings-reading-display-mode");
    expect(parseDevIntent("open-web-preview-geometry-check")).toBe("open-web-preview-geometry-check");
  });

  it("rejects removed legacy overlay intents", () => {
    expect(parseDevIntent("image-viewer-overlay")).toBeNull();
    expect(parseDevIntent("unknown")).toBeNull();
    expect(parseDevIntent(undefined)).toBeNull();
  });

  it("prefers the short dev intent env name", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_INTENT", "open-web-preview-url");
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "image-viewer-overlay");

    expect(readDevIntent()).toBe("open-web-preview-url");
  });

  it("ignores the removed legacy dev intent env name", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "image-viewer-overlay");

    expect(readDevIntent()).toBeNull();
  });

  it("prefers the short dev web url env name", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_WEB_URL", "https://example.com/short");
    vi.stubEnv("VITE_ULTRA_RSS_DEV_WEB_URL", "https://example.com/legacy");

    expect(readDevWebUrl()).toBe("https://example.com/short");
  });

  it("ignores the removed legacy dev web url env name", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_ULTRA_RSS_DEV_WEB_URL", "https://example.com/legacy");

    expect(readDevWebUrl()).toBeNull();
  });

  it("reads a short dev window size for scenario verification", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_WINDOW_WIDTH", "520");
    vi.stubEnv("VITE_DEV_WINDOW_HEIGHT", "900");

    expect(readDevWindowSize()).toEqual({
      width: 520,
      height: 900,
    });
  });

  it("ignores invalid dev window size values", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_WINDOW_WIDTH", "wide");
    vi.stubEnv("VITE_DEV_WINDOW_HEIGHT", "-1");

    expect(readDevWindowSize()).toBeNull();
  });
});
