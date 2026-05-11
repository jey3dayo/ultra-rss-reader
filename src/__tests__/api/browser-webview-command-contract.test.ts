import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Result } from "@praha/byethrow";
import { expectTauriCommandValidationError, suppressConsoleError } from "@tests/helpers/console-spies";
import { extractRustStructFields } from "@tests/helpers/tauri-command-contract";
import { createTauriMockCallRecorder, setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { describe, expect, it } from "vitest";
import {
  BrowserWebviewDiagnosticsPayloadSchema,
  BrowserWebviewFallbackPayloadSchema,
  BrowserWebviewStateSchema,
} from "@/api/schemas";
import {
  BROWSER_WEBVIEW_EVENT_NAMES,
  BROWSER_WEBVIEW_EVENT_PAYLOAD_SCHEMAS,
  BrowserWebviewClosedPayloadSchema,
  BrowserWebviewDebugInputPayloadSchema,
} from "@/api/schemas/browser-webview";
import {
  closeBrowserWebview,
  createOrUpdateBrowserWebview,
  focusBrowserWebview,
  goBackBrowserWebview,
  goForwardBrowserWebview,
  reloadBrowserWebview,
  setBrowserWebviewBounds,
} from "@/api/tauri-commands";
import { BROWSER_WINDOW_EVENTS } from "@/constants/browser";
import type { BrowserWebviewBounds } from "@/lib/browser/browser-webview";

const browserBounds: BrowserWebviewBounds = {
  x: 380,
  y: 48,
  width: 900,
  height: 720,
};

type CommandValidationError = {
  message: string;
};

async function runCommandCases<
  TCommand extends readonly [string, () => Promise<Result.Result<unknown, CommandValidationError>>],
>(
  commandCases: readonly TCommand[],
): Promise<Array<readonly [string, Result.Result<unknown, CommandValidationError>]>> {
  return Promise.all(
    commandCases.map(async ([command, runCommand]) => {
      const result = await runCommand();
      return [command, result] as const;
    }),
  );
}

async function runResponseValidationCommandCases<
  TCommand extends readonly [string, () => Promise<Result.Result<unknown, CommandValidationError>>],
>(
  commandCases: readonly TCommand[],
): Promise<Array<readonly [string, Result.Result<unknown, CommandValidationError>]>> {
  const consoleError = suppressConsoleError();
  const results = await runCommandCases(commandCases);

  for (const [command] of results) {
    expectTauriCommandValidationError(consoleError, command, "response");
  }

  return results;
}

function readRustBrowserWebviewSource() {
  return readFileSync(join(process.cwd(), "src-tauri/src/browser_webview.rs"), "utf8");
}

function extractRustStringConst(source: string, constName: string) {
  const constMatch = source.match(new RegExp(`pub const ${constName}: &str = "([^"]+)";`));
  expect(constMatch, `${constName} should exist in Rust browser_webview.rs`).not.toBeNull();
  if (!constMatch?.[1]) {
    throw new Error(`${constName} should have a string literal value`);
  }

  return constMatch[1];
}

function extractRustEventNames(source: string) {
  const eventNamesMatch = source.match(/pub const BROWSER_WEBVIEW_EVENT_NAMES: &\[&str\] = &\[([\s\S]*?)\];/);
  expect(eventNamesMatch, "BROWSER_WEBVIEW_EVENT_NAMES should exist in Rust browser_webview.rs").not.toBeNull();

  return (eventNamesMatch?.[1] ?? "")
    .split("\n")
    .map((line) => line.trim().replace(/,$/, ""))
    .filter(Boolean)
    .map((constName) => extractRustStringConst(source, constName))
    .toSorted();
}

describe("browser webview command contract", () => {
  it("keeps browser webview event name registries aligned with Rust and frontend listeners", () => {
    const eventNames = Object.values(BROWSER_WEBVIEW_EVENT_NAMES).toSorted();

    expect(eventNames).toEqual(extractRustEventNames(readRustBrowserWebviewSource()));
    expect(Object.keys(BROWSER_WEBVIEW_EVENT_PAYLOAD_SCHEMAS).toSorted()).toEqual(eventNames);
    expect(Object.values(BROWSER_WINDOW_EVENTS).toSorted()).toEqual(
      [
        BROWSER_WEBVIEW_EVENT_NAMES.closed,
        BROWSER_WEBVIEW_EVENT_NAMES.diagnostics,
        BROWSER_WEBVIEW_EVENT_NAMES.fallback,
        BROWSER_WEBVIEW_EVENT_NAMES.stateChanged,
      ].toSorted(),
    );
  });

  it("keeps BrowserWebviewState schema fields aligned with the Rust DTO", () => {
    expect(Object.keys(BrowserWebviewStateSchema.shape).toSorted()).toEqual(
      extractRustStructFields(readRustBrowserWebviewSource(), "BrowserWebviewState", "Rust browser_webview.rs"),
    );
  });

  it("keeps browser webview event payload schemas aligned with the Rust DTOs", () => {
    const source = readRustBrowserWebviewSource();

    expect(Object.keys(BrowserWebviewFallbackPayloadSchema.shape).toSorted()).toEqual(
      extractRustStructFields(source, "BrowserWebviewFallbackPayload", "Rust browser_webview.rs"),
    );
    expect(Object.keys(BrowserWebviewDiagnosticsPayloadSchema.shape).toSorted()).toEqual(
      extractRustStructFields(source, "BrowserWebviewDiagnosticsPayload", "Rust browser_webview.rs"),
    );
    expect(Object.keys(BrowserWebviewClosedPayloadSchema.shape).toSorted()).toEqual(["load_generation", "url"]);
    expect(BrowserWebviewDebugInputPayloadSchema.parse("native-click target=webview")).toBe(
      "native-click target=webview",
    );
  });

  it("validates browser webview state command responses", async () => {
    const stateCommandCases = [
      [
        "create_or_update_browser_webview",
        () => createOrUpdateBrowserWebview("https://example.com/article", browserBounds),
      ],
      ["go_back_browser_webview", () => goBackBrowserWebview()],
      ["go_forward_browser_webview", () => goForwardBrowserWebview()],
      ["reload_browser_webview", () => reloadBrowserWebview()],
    ] as const;

    setupTauriMocks((cmd) => {
      if (stateCommandCases.some(([command]) => command === cmd)) {
        return {
          url: "https://example.com/article",
          can_go_back: "false",
          can_go_forward: false,
          is_loading: false,
        };
      }
      return null;
    });

    for (const [command, result] of await runResponseValidationCommandCases(stateCommandCases)) {
      expect(Result.isFailure(result), command).toBe(true);
      expect(Result.unwrapError(result).message).toContain("validation failed");
    }
  });

  it("validates browser webview null command responses", async () => {
    const nullCommandCases = [
      ["set_browser_webview_bounds", () => setBrowserWebviewBounds(browserBounds)],
      ["focus_browser_webview", () => focusBrowserWebview()],
      ["close_browser_webview", () => closeBrowserWebview()],
    ] as const;

    setupTauriMocks((cmd) => {
      if (nullCommandCases.some(([command]) => command === cmd)) {
        return { ok: true };
      }
      return null;
    });

    for (const [command, result] of await runResponseValidationCommandCases(nullCommandCases)) {
      expect(Result.isFailure(result), command).toBe(true);
      expect(Result.unwrapError(result).message).toContain("validation failed");
    }
  });

  it("validates browser webview command bounds as integer geometry", async () => {
    const consoleError = suppressConsoleError();
    setupTauriMocks(() => null);

    const result = await setBrowserWebviewBounds({
      x: 10.5,
      y: 20,
      width: 320,
      height: 240,
    });

    expect(Result.isFailure(result)).toBe(true);
    expect(Result.unwrapError(result).message).toContain("validation failed");
    expectTauriCommandValidationError(consoleError, "set_browser_webview_bounds", "args");
  });

  it("normalizes negative zero before invoking browser webview geometry commands", async () => {
    const recorder = createTauriMockCallRecorder((cmd) => {
      if (cmd === "set_browser_webview_bounds") {
        return null;
      }
      return undefined;
    });
    setupTauriMocks(recorder.handler);

    const result = await setBrowserWebviewBounds({
      x: -0,
      y: -0,
      width: 320,
      height: 240,
    });

    expect(Result.isSuccess(result)).toBe(true);
    expect(recorder.calls).toEqual([
      {
        cmd: "set_browser_webview_bounds",
        args: {
          bounds: {
            x: 0,
            y: 0,
            width: 320,
            height: 240,
          },
        },
      },
    ]);
  });
});
