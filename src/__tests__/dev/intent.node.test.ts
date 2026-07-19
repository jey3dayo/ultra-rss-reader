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
  DEV_RUNTIME_ENV_KEYS,
  loadDevRuntimeOptions,
  loadDevRuntimeOptionsResult,
  parseDevIntent,
  readDevIntent,
  readDevWebUrl,
  readDevWindowSize,
  resetDevRuntimeOptionsCacheForTests,
} from "@/dev/intent";
import { DEV_SCENARIO_IDS } from "@/dev/scenario-ids";
import { RESPONSE_VALIDATION_MESSAGE } from "@/lib/ui-errors";

function expectResultValue<T, E>(result: Result.Result<T, E>): T {
  if (Result.isFailure(result)) {
    throw new Error(`Expected success result, received failure: ${JSON.stringify(result.error)}`);
  }

  return result.value;
}

function expectResultError<T, E>(result: Result.Result<T, E>): E {
  if (!Result.isFailure(result)) {
    throw new Error(`Expected failure result, received success: ${JSON.stringify(result.value)}`);
  }

  return result.error;
}

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

  it("keeps dev runtime env aliases as the source of truth", () => {
    expect(DEV_RUNTIME_ENV_KEYS).toEqual({
      intent: ["VITE_DEV_INTENT", "VITE_ULTRA_RSS_DEV_INTENT"],
      webUrl: ["VITE_DEV_WEB_URL", "VITE_ULTRA_RSS_DEV_WEB_URL"],
      windowWidth: ["VITE_DEV_WINDOW_WIDTH"],
      windowHeight: ["VITE_DEV_WINDOW_HEIGHT"],
    });
  });

  it("prefers the short dev intent env name over the legacy alias", () => {
    vi.stubEnv("VITE_DEV_INTENT", " open-web-preview-url ");
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "open-settings-general");

    expect(readDevIntent()).toBe("open-web-preview-url");
  });

  it("falls through to the legacy dev intent alias when the short env name is blank", () => {
    vi.stubEnv("VITE_DEV_INTENT", "   ");
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "open-settings-general");

    expect(readDevIntent()).toBe("open-settings-general");
  });

  it("reads the legacy dev intent alias when the short env name is unset", () => {
    vi.stubEnv("VITE_ULTRA_RSS_DEV_INTENT", "open-settings-general");

    expect(readDevIntent()).toBe("open-settings-general");
  });

  it("prefers the short dev web url env name over the legacy alias", () => {
    vi.stubEnv("VITE_DEV_WEB_URL", "https://example.com/short");
    vi.stubEnv("VITE_ULTRA_RSS_DEV_WEB_URL", "https://example.com/legacy");

    expect(readDevWebUrl()).toBe("https://example.com/short");
  });

  it("falls through to the legacy dev web url alias when the short env name is invalid", () => {
    vi.stubEnv("VITE_DEV_WEB_URL", "file:///tmp/article.html");
    vi.stubEnv("VITE_ULTRA_RSS_DEV_WEB_URL", " http://localhost:1420/preview ");

    expect(readDevWebUrl()).toBe("http://localhost:1420/preview");
  });

  it("reads the legacy dev web url alias when the short env name is unset", () => {
    vi.stubEnv("VITE_ULTRA_RSS_DEV_WEB_URL", "https://example.com/legacy");

    expect(readDevWebUrl()).toBe("https://example.com/legacy");
  });

  it.each(["http://localhost:1420/preview", "http://127.0.0.1:1420/preview", "http://[::1]:1420/preview"])(
    "accepts private dev web URL hosts allowed by browser/open URL schema: %s",
    (url) => {
      vi.stubEnv("VITE_DEV_WEB_URL", url);

      expect(readDevWebUrl()).toBe(url);
    },
  );

  it.each(["", "   ", "file:///tmp/article.html", "mailto:test@example.com", "/relative/path"])(
    "ignores invalid dev web URL env values before runtime fallback: %j",
    async (url) => {
      vi.stubEnv("VITE_DEV_WEB_URL", url);
      getDevRuntimeOptionsMock.mockResolvedValueOnce(
        Result.succeed({
          dev_intent: null,
          dev_web_url: "https://example.com/runtime",
          dev_window_width: null,
          dev_window_height: null,
        }),
      );

      expect(Result.isSuccess(await loadDevRuntimeOptionsResult())).toBe(true);
      expect(readDevWebUrl()).toBe("https://example.com/runtime");
    },
  );

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
    ["float", "520.5", "900.1"],
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

  it("keeps valid dev window dimension sides independently", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_WINDOW_HEIGHT", "900");

    expect(readDevWindowSize()).toEqual({
      width: null,
      height: 900,
    });
  });

  it("accepts the dev window dimension max boundary from env", () => {
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_DEV_WINDOW_WIDTH", "10000");
    vi.stubEnv("VITE_DEV_WINDOW_HEIGHT", "10000");

    expect(readDevWindowSize()).toEqual({
      width: 10000,
      height: 10000,
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

    expect(expectResultValue(result)).toEqual({
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

  it.each([
    [
      "env only",
      {
        env: {
          VITE_DEV_INTENT: "open-web-preview-url",
          VITE_DEV_WEB_URL: "https://example.com/env",
          VITE_DEV_WINDOW_WIDTH: "520",
          VITE_DEV_WINDOW_HEIGHT: "900",
        },
        runtime: {
          dev_intent: null,
          dev_web_url: null,
          dev_window_width: null,
          dev_window_height: null,
        },
        expectedIntent: "open-web-preview-url",
        expectedWebUrl: "https://example.com/env",
        expectedWindowSize: { width: 520, height: 900 },
      },
    ],
    [
      "Tauri only",
      {
        env: {},
        runtime: {
          dev_intent: "open-command-palette",
          dev_web_url: "https://example.com/runtime",
          dev_window_width: 640,
          dev_window_height: 820,
        },
        expectedIntent: "open-command-palette",
        expectedWebUrl: "https://example.com/runtime",
        expectedWindowSize: { width: 640, height: 820 },
      },
    ],
    [
      "both present",
      {
        env: {
          VITE_DEV_INTENT: "open-web-preview-url",
          VITE_DEV_WEB_URL: "https://example.com/env",
          VITE_DEV_WINDOW_WIDTH: "520",
          VITE_DEV_WINDOW_HEIGHT: "900",
        },
        runtime: {
          dev_intent: "open-command-palette",
          dev_web_url: "https://example.com/runtime",
          dev_window_width: 640,
          dev_window_height: 820,
        },
        expectedIntent: "open-web-preview-url",
        expectedWebUrl: "https://example.com/env",
        expectedWindowSize: { width: 520, height: 900 },
      },
    ],
    [
      "invalid env intent and size",
      {
        env: {
          VITE_DEV_INTENT: "removed-dev-intent",
          VITE_DEV_WINDOW_WIDTH: "10001",
          VITE_DEV_WINDOW_HEIGHT: "tall",
        },
        runtime: {
          dev_intent: "open-settings-general",
          dev_web_url: "https://example.com/runtime",
          dev_window_width: 640,
          dev_window_height: 820,
        },
        expectedIntent: "open-settings-general",
        expectedWebUrl: "https://example.com/runtime",
        expectedWindowSize: null,
      },
    ],
  ] as const)("fixes dev runtime option precedence for %s", async (_label, scenario) => {
    for (const [key, value] of Object.entries(scenario.env)) {
      vi.stubEnv(key, value);
    }
    getDevRuntimeOptionsMock.mockResolvedValueOnce(Result.succeed(scenario.runtime));

    expect(Result.isSuccess(await loadDevRuntimeOptionsResult())).toBe(true);

    expect(readDevIntent()).toBe(scenario.expectedIntent);
    expect(readDevWebUrl()).toBe(scenario.expectedWebUrl);
    expect(readDevWindowSize()).toEqual(scenario.expectedWindowSize);
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

  it("returns typed runtime option failures for unavailable contexts", async () => {
    vi.stubEnv("DEV", false);
    expect(expectResultError(await loadDevRuntimeOptionsResult())).toBe("not_dev_build");
    expect(await loadDevRuntimeOptions()).toBeNull();

    vi.stubEnv("DEV", true);
    resetDevRuntimeOptionsCacheForTests();
    hasTauriRuntimeMock.mockReturnValue(false);

    expect(expectResultError(await loadDevRuntimeOptionsResult())).toBe("tauri_unavailable");
    expect(await loadDevRuntimeOptions()).toBeNull();
  });

  it("returns a typed runtime option failure when the Tauri request fails", async () => {
    getDevRuntimeOptionsMock.mockResolvedValueOnce(Result.fail({ type: "UserVisible", message: "boom" }));

    const result = await loadDevRuntimeOptionsResult();

    expect(expectResultError(result)).toBe("request_failed");
    expect(getDevRuntimeOptionsMock).toHaveBeenCalledTimes(1);
  });

  it("returns a typed runtime option failure when response validation reports malformed JSON", async () => {
    getDevRuntimeOptionsMock.mockResolvedValueOnce(
      Result.fail({ type: "Diagnostics", message: RESPONSE_VALIDATION_MESSAGE }),
    );

    const result = await loadDevRuntimeOptionsResult();

    expect(expectResultError(result)).toBe("malformed_runtime_options");
    expect(getDevRuntimeOptionsMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "partial option",
      {
        dev_intent: null,
        dev_web_url: null,
        dev_window_width: null,
      },
      "malformed_runtime_options",
    ],
    [
      "non-integer window size",
      {
        dev_intent: null,
        dev_web_url: null,
        dev_window_width: 640.4,
        dev_window_height: null,
      },
      "malformed_runtime_options",
    ],
    [
      "invalid window size",
      {
        dev_intent: null,
        dev_web_url: null,
        dev_window_width: 10_001,
        dev_window_height: null,
      },
      "malformed_runtime_options",
    ],
    [
      "unknown scenario",
      {
        dev_intent: "removed-dev-intent",
        dev_web_url: null,
        dev_window_width: null,
        dev_window_height: null,
      },
      "unknown_dev_intent",
    ],
  ] as const)("returns a typed runtime option failure for %s", async (_label, runtimeOptions, expectedError) => {
    getDevRuntimeOptionsMock.mockResolvedValueOnce(Result.succeed(runtimeOptions));

    const result = await loadDevRuntimeOptionsResult();

    expect(expectResultError(result)).toBe(expectedError);
    expect(readDevIntent()).toBeNull();
    expect(readDevWebUrl()).toBeNull();
    expect(readDevWindowSize()).toBeNull();
  });

  it("clears a failed runtime option promise so the next request can refresh dev intent", async () => {
    let resolveFirstRequest:
      | ((
          result: Result.Result<
            {
              dev_intent: null;
              dev_web_url: null;
              dev_window_width: null;
              dev_window_height: null;
            },
            { type: "UserVisible"; message: string }
          >,
        ) => void)
      | null = null;
    getDevRuntimeOptionsMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirstRequest = resolve;
      }),
    );

    const firstLoad = loadDevRuntimeOptionsResult();
    const sharedLoad = loadDevRuntimeOptionsResult();
    if (!resolveFirstRequest) {
      throw new Error("Expected runtime options request to be captured");
    }
    (
      resolveFirstRequest as (
        result: Result.Result<
          {
            dev_intent: null;
            dev_web_url: null;
            dev_window_width: null;
            dev_window_height: null;
          },
          { type: "UserVisible"; message: string }
        >,
      ) => void
    )(Result.fail({ type: "UserVisible", message: "boom" }));

    expect(expectResultError(await firstLoad)).toBe("request_failed");
    expect(expectResultError(await sharedLoad)).toBe("request_failed");

    getDevRuntimeOptionsMock.mockResolvedValueOnce(
      Result.succeed({
        dev_intent: "open-command-palette",
        dev_web_url: "https://example.com/recovered",
        dev_window_width: 640,
        dev_window_height: 820,
      }),
    );

    const recovered = await loadDevRuntimeOptionsResult();

    expect(expectResultValue(recovered).dev_intent).toBe("open-command-palette");
    expect(readDevIntent()).toBe("open-command-palette");
    expect(getDevRuntimeOptionsMock).toHaveBeenCalledTimes(2);
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
  ] as const)(
    "only retries retryable runtime option failures: %s",
    async (expectedError, shouldRetry, expectedCallCount, arrangeFailure) => {
      arrangeFailure();
      getDevRuntimeOptionsMock.mockResolvedValueOnce(
        Result.succeed({
          dev_intent: "open-settings-general",
          dev_web_url: "https://example.com/retry",
          dev_window_width: 720,
          dev_window_height: 960,
        }),
      );

      expect(expectResultError(await loadDevRuntimeOptionsResult())).toBe(expectedError);
      const result = await loadDevRuntimeOptionsResult();

      if (shouldRetry) {
        expect(expectResultValue(result)).toEqual({
          dev_intent: "open-settings-general",
          dev_web_url: "https://example.com/retry",
          dev_window_width: 720,
          dev_window_height: 960,
        });
      } else {
        expect(expectResultError(result)).toBe(expectedError);
      }
      expect(getDevRuntimeOptionsMock).toHaveBeenCalledTimes(expectedCallCount);
    },
  );

  it.each([
    ["not_dev_build", () => vi.stubEnv("DEV", false)],
    ["tauri_unavailable", () => hasTauriRuntimeMock.mockReturnValue(false)],
  ] as const)("keeps %s runtime option failures cached", async (expectedError, arrangeFailure) => {
    arrangeFailure();

    expect(expectResultError(await loadDevRuntimeOptionsResult())).toBe(expectedError);
    expect(expectResultError(await loadDevRuntimeOptionsResult())).toBe(expectedError);
    expect(getDevRuntimeOptionsMock).not.toHaveBeenCalled();
  });
});
