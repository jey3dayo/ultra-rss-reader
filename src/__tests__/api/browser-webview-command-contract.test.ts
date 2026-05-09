import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Result } from "@praha/byethrow";
import { setupTauriMocks } from "@tests/helpers/tauri-mocks";
import { describe, expect, it } from "vitest";
import { BrowserWebviewStateSchema } from "@/api/schemas";
import {
  closeBrowserWebview,
  createOrUpdateBrowserWebview,
  focusBrowserWebview,
  goBackBrowserWebview,
  goForwardBrowserWebview,
  reloadBrowserWebview,
  setBrowserWebviewBounds,
} from "@/api/tauri-commands";
import type { BrowserWebviewBounds } from "@/lib/browser/browser-webview";

const browserBounds: BrowserWebviewBounds = {
  x: 380,
  y: 48,
  width: 900,
  height: 720,
};

function readRustBrowserWebviewSource() {
  return readFileSync(join(process.cwd(), "src-tauri/src/browser_webview.rs"), "utf8");
}

function extractRustBrowserWebviewStateFields(source: string) {
  const structMatch = source.match(/pub struct BrowserWebviewState \{([\s\S]*?)\n\}/);
  expect(structMatch, "BrowserWebviewState should exist in Rust browser_webview.rs").not.toBeNull();

  return [...(structMatch?.[1] ?? "").matchAll(/^ {4}pub ([a-zA-Z0-9_]+):/gm)].map((match) => match[1]).sort();
}

describe("browser webview command contract", () => {
  it("keeps BrowserWebviewState schema fields aligned with the Rust DTO", () => {
    expect(Object.keys(BrowserWebviewStateSchema.shape).sort()).toEqual(
      extractRustBrowserWebviewStateFields(readRustBrowserWebviewSource()),
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

    for (const [command, runCommand] of stateCommandCases) {
      const result = await runCommand();
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

    for (const [command, runCommand] of nullCommandCases) {
      const result = await runCommand();
      expect(Result.isFailure(result), command).toBe(true);
      expect(Result.unwrapError(result).message).toContain("validation failed");
    }
  });
});
