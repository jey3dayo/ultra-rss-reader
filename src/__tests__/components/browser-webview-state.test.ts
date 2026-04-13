import { describe, expect, it } from "vitest";
import {
  initialBrowserState,
  isMissingEmbeddedBrowserWebviewError,
  mergeBrowserState,
} from "@/components/reader/browser-webview-state";

describe("browser-webview-state", () => {
  it("creates an initial loading state for a requested url", () => {
    expect(initialBrowserState("https://example.com/article")).toEqual({
      url: "https://example.com/article",
      can_go_back: false,
      can_go_forward: false,
      is_loading: true,
    });
  });

  it("keeps the previous url while a new page starts loading", () => {
    expect(
      mergeBrowserState(
        {
          url: "https://example.com/old",
          can_go_back: false,
          can_go_forward: false,
          is_loading: false,
        },
        {
          url: "https://example.com/new",
          can_go_back: true,
          can_go_forward: false,
          is_loading: true,
        },
        "https://example.com/new",
      ),
    ).toEqual({
      url: "https://example.com/old",
      can_go_back: true,
      can_go_forward: false,
      is_loading: false,
    });
  });

  it("keeps the intended url while loading updates briefly report a stale url", () => {
    expect(
      mergeBrowserState(
        {
          url: "https://example.com/intended",
          can_go_back: false,
          can_go_forward: false,
          is_loading: true,
        },
        {
          url: "https://example.com/stale",
          can_go_back: true,
          can_go_forward: true,
          is_loading: true,
        },
        "https://example.com/intended",
      ),
    ).toEqual({
      url: "https://example.com/intended",
      can_go_back: true,
      can_go_forward: true,
      is_loading: true,
    });
  });

  it("detects the missing embedded browser webview error", () => {
    expect(
      isMissingEmbeddedBrowserWebviewError({
        type: "UserVisible",
        message: "Embedded browser webview is not open",
      }),
    ).toBe(true);
    expect(
      isMissingEmbeddedBrowserWebviewError({
        type: "UserVisible",
        message: "Something else failed",
      }),
    ).toBe(false);
  });
});
