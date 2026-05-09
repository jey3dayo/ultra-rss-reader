import { Result } from "@praha/byethrow";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getDevRuntimeOptionsMock, hasTauriRuntimeMock } = vi.hoisted(() => ({
  getDevRuntimeOptionsMock: vi.fn(),
  hasTauriRuntimeMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  getDevRuntimeOptions: getDevRuntimeOptionsMock,
}));

vi.mock("@/lib/window/window-chrome", () => ({
  hasTauriRuntime: hasTauriRuntimeMock,
}));

import {
  loadDevRuntimeOptions,
  loadDevRuntimeOptionsResult,
  parseDevIntent,
  readDevIntent,
  readDevWebUrl,
  readDevWindowSize,
  resetDevRuntimeOptionsCacheForTests,
} from "@/dev/intent";
import { DEV_SCENARIO_IDS } from "@/dev/scenario-ids";

describe("dev-intent helpers", () => {
  beforeEach(() => {
    vi.stubEnv("DEV", true);
    resetDevRuntimeOptionsCacheForTests();
    getDevRuntimeOptionsMock.mockReset().mockResolvedValue(
      Result.succeed({
        dev_intent: null,
        dev_web_url: null,
        dev_window_width: null,
        dev_window_height: null,
      }),
    );
    hasTauriRuntimeMock.mockReset().mockReturnValue(true);
  });

  afterEach(() => {
    resetDevRuntimeOptionsCacheForTests();
    vi.unstubAllEnvs();
  });

  it("parses known dev scenario ids", () => {
    for (const scenarioId of DEV_SCENARIO_IDS) {
      expect(parseDevIntent(scenarioId)).toBe(scenarioId);
    }
  });

  it("rejects removed legacy overlay intents", () => {
    expect(parseDevIntent("image-viewer-overlay")).toBeNull();
    expect(parseDevIntent("unknown")).toBeNull();
    expect(parseDevIntent(undefined)).toBeNull();
  });

  it("prefers the short dev intent env name", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_INTENT", " open-web-preview-url ");
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
    vi.stubEnv("VITE_DEV_WINDOW_WIDTH", " 520 ");
    vi.stubEnv("VITE_DEV_WINDOW_HEIGHT", " 900 ");

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

  it.each([
    ["zero", "0", "0"],
    ["negative", "-1", "-200"],
    ["non-numeric", "wide", "tall"],
    ["overlarge", "10001", "10001"],
  ] as const)("drops %s dev window dimensions from env", (_label, width, height) => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_WINDOW_WIDTH", width);
    vi.stubEnv("VITE_DEV_WINDOW_HEIGHT", height);

    expect(readDevWindowSize()).toBeNull();
  });

  it("keeps valid env dimensions while dropping invalid ones", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_WINDOW_WIDTH", "520");
    vi.stubEnv("VITE_DEV_WINDOW_HEIGHT", "tall");

    expect(readDevWindowSize()).toEqual({
      width: 520,
      height: null,
    });
  });

  it("loads runtime dev options as a typed Result", async () => {
    getDevRuntimeOptionsMock.mockResolvedValueOnce(
      Result.succeed({
        dev_intent: "open-command-palette",
        dev_web_url: "https://example.com/runtime",
        dev_window_width: 640,
        dev_window_height: 820,
      }),
    );

    const result = await loadDevRuntimeOptionsResult();

    expect(Result.unwrap(result)).toEqual({
      dev_intent: "open-command-palette",
      dev_web_url: "https://example.com/runtime",
      dev_window_width: 640,
      dev_window_height: 820,
    });
    expect(await loadDevRuntimeOptions()).toEqual({
      dev_intent: "open-command-palette",
      dev_web_url: "https://example.com/runtime",
      dev_window_width: 640,
      dev_window_height: 820,
    });
    expect(readDevIntent()).toBe("open-command-palette");
    expect(readDevWebUrl()).toBe("https://example.com/runtime");
    expect(readDevWindowSize()).toEqual({ width: 640, height: 820 });
    expect(getDevRuntimeOptionsMock).toHaveBeenCalledTimes(1);
  });

  it("keeps explicit env dev options ahead of loaded runtime values", async () => {
    vi.stubEnv("VITE_DEV_INTENT", "open-web-preview-url");
    vi.stubEnv("VITE_DEV_WEB_URL", "https://example.com/env");
    vi.stubEnv("VITE_DEV_WINDOW_WIDTH", "520");
    vi.stubEnv("VITE_DEV_WINDOW_HEIGHT", "900");
    getDevRuntimeOptionsMock.mockResolvedValueOnce(
      Result.succeed({
        dev_intent: "open-command-palette",
        dev_web_url: "https://example.com/runtime",
        dev_window_width: 640,
        dev_window_height: 820,
      }),
    );

    expect(Result.isSuccess(await loadDevRuntimeOptionsResult())).toBe(true);

    expect(readDevIntent()).toBe("open-web-preview-url");
    expect(readDevWebUrl()).toBe("https://example.com/env");
    expect(readDevWindowSize()).toEqual({ width: 520, height: 900 });
  });

  it("falls back to runtime dev intent when VITE_DEV_INTENT is unset", async () => {
    getDevRuntimeOptionsMock.mockResolvedValueOnce(
      Result.succeed({
        dev_intent: "open-command-palette",
        dev_web_url: null,
        dev_window_width: null,
        dev_window_height: null,
      }),
    );

    expect(Result.isSuccess(await loadDevRuntimeOptionsResult())).toBe(true);

    expect(readDevIntent()).toBe("open-command-palette");
  });

  it("falls back to runtime dev intent when VITE_DEV_INTENT is invalid", async () => {
    vi.stubEnv("VITE_DEV_INTENT", "removed-dev-intent");
    getDevRuntimeOptionsMock.mockResolvedValueOnce(
      Result.succeed({
        dev_intent: "open-settings-general",
        dev_web_url: null,
        dev_window_width: null,
        dev_window_height: null,
      }),
    );

    expect(Result.isSuccess(await loadDevRuntimeOptionsResult())).toBe(true);

    expect(readDevIntent()).toBe("open-settings-general");
  });

  it("uses the unset fallback when neither env nor runtime dev intent is available", async () => {
    getDevRuntimeOptionsMock.mockResolvedValueOnce(
      Result.succeed({
        dev_intent: null,
        dev_web_url: null,
        dev_window_width: null,
        dev_window_height: null,
      }),
    );

    expect(Result.isSuccess(await loadDevRuntimeOptionsResult())).toBe(true);

    expect(readDevIntent()).toBeNull();
  });

  it("rounds positive runtime window dimensions and drops invalid runtime values", async () => {
    getDevRuntimeOptionsMock.mockResolvedValueOnce(
      Result.succeed({
        dev_intent: null,
        dev_web_url: null,
        dev_window_width: 640.4,
        dev_window_height: 0,
      }),
    );

    expect(Result.isSuccess(await loadDevRuntimeOptionsResult())).toBe(true);

    expect(readDevWindowSize()).toEqual({ width: 640, height: null });
  });

  it("drops overlarge runtime window dimensions", async () => {
    getDevRuntimeOptionsMock.mockResolvedValueOnce(
      Result.succeed({
        dev_intent: null,
        dev_web_url: null,
        dev_window_width: 10_001,
        dev_window_height: 900,
      }),
    );

    expect(Result.isSuccess(await loadDevRuntimeOptionsResult())).toBe(true);

    expect(readDevWindowSize()).toEqual({ width: null, height: 900 });
  });

  it("returns typed runtime option failures for unavailable contexts", async () => {
    vi.stubEnv("DEV", false);
    expect(Result.unwrapError(await loadDevRuntimeOptionsResult())).toBe("not_dev_build");
    expect(await loadDevRuntimeOptions()).toBeNull();

    vi.stubEnv("DEV", true);
    resetDevRuntimeOptionsCacheForTests();
    hasTauriRuntimeMock.mockReturnValue(false);

    expect(Result.unwrapError(await loadDevRuntimeOptionsResult())).toBe("tauri_unavailable");
    expect(await loadDevRuntimeOptions()).toBeNull();
  });

  it("returns a typed runtime option failure when the Tauri request fails", async () => {
    getDevRuntimeOptionsMock.mockResolvedValueOnce(Result.fail({ type: "UserVisible", message: "boom" }));

    const result = await loadDevRuntimeOptionsResult();

    expect(Result.unwrapError(result)).toBe("request_failed");
    expect(getDevRuntimeOptionsMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "request_failed",
      true,
      2,
      () => getDevRuntimeOptionsMock.mockResolvedValueOnce(Result.fail({ type: "UserVisible", message: "boom" })),
    ],
    ["tauri_unavailable", false, 0, () => hasTauriRuntimeMock.mockReturnValue(false)],
    ["not_dev_build", false, 0, () => vi.stubEnv("DEV", false)],
  ] as const)("only retries retryable runtime option failures: %s", async (expectedError, shouldRetry, expectedCallCount, arrangeFailure) => {
    arrangeFailure();
    getDevRuntimeOptionsMock.mockResolvedValueOnce(
      Result.succeed({
        dev_intent: "open-settings-general",
        dev_web_url: "https://example.com/retry",
        dev_window_width: 720,
        dev_window_height: 960,
      }),
    );

    expect(Result.unwrapError(await loadDevRuntimeOptionsResult())).toBe(expectedError);
    const result = await loadDevRuntimeOptionsResult();

    if (shouldRetry) {
      expect(Result.unwrap(result)).toEqual({
        dev_intent: "open-settings-general",
        dev_web_url: "https://example.com/retry",
        dev_window_width: 720,
        dev_window_height: 960,
      });
    } else {
      expect(Result.unwrapError(result)).toBe(expectedError);
    }
    expect(getDevRuntimeOptionsMock).toHaveBeenCalledTimes(expectedCallCount);
  });

  it.each([
    ["not_dev_build", () => vi.stubEnv("DEV", false)],
    ["tauri_unavailable", () => hasTauriRuntimeMock.mockReturnValue(false)],
  ] as const)("keeps %s runtime option failures cached", async (expectedError, arrangeFailure) => {
    arrangeFailure();

    expect(Result.unwrapError(await loadDevRuntimeOptionsResult())).toBe(expectedError);
    expect(Result.unwrapError(await loadDevRuntimeOptionsResult())).toBe(expectedError);
    expect(getDevRuntimeOptionsMock).not.toHaveBeenCalled();
  });
});
