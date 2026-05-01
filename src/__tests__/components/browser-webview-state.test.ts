import { describe, expect, it, vi } from "vitest";
import {
  initialBrowserState,
  isMissingEmbeddedBrowserWebviewError,
  mergeBrowserState,
  resolveBrowserStateForRequestedUrl,
  updateBrowserStateWithRef,
} from "@/components/reader/browser-webview-state";
import { useUiStore } from "@/stores/ui-store";

describe("browser-webview-state", () => {
  it("creates an initial loading state for a requested url", () => {
    expect(initialBrowserState("https://example.com/article")).toEqual({
      url: "https://example.com/article",
      can_go_back: false,
      can_go_forward: false,
      is_loading: true,
    });
  });

  it("reuses the current state when the requested url has not changed", () => {
    const currentState = {
      url: "https://example.com/article",
      can_go_back: true,
      can_go_forward: false,
      is_loading: false,
    } satisfies ReturnType<typeof initialBrowserState>;

    expect(resolveBrowserStateForRequestedUrl(currentState, "https://example.com/article")).toBe(currentState);
  });

  it("resets to the initial loading state when the requested url changes", () => {
    expect(
      resolveBrowserStateForRequestedUrl(
        {
          url: "https://example.com/old",
          can_go_back: true,
          can_go_forward: true,
          is_loading: false,
        },
        "https://example.com/new",
      ),
    ).toEqual({
      url: "https://example.com/new",
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

  it("updates the browser ref and navigation store outside the React state updater", () => {
    useUiStore.setState(useUiStore.getInitialState());
    const browserStateRef = {
      current: {
        url: "https://example.com/current",
        can_go_back: false,
        can_go_forward: false,
        is_loading: true,
      },
    };
    const setBrowserState = vi.fn();

    updateBrowserStateWithRef(browserStateRef, setBrowserState, (currentState) => ({
      url: currentState?.url ?? "https://example.com/fallback",
      can_go_back: true,
      can_go_forward: false,
      is_loading: false,
    }));

    expect(browserStateRef.current).toEqual({
      url: "https://example.com/current",
      can_go_back: true,
      can_go_forward: false,
      is_loading: false,
    });
    expect(useUiStore.getState().browserNavigationState).toEqual({
      canGoBack: true,
      canGoForward: false,
    });
    expect(setBrowserState).toHaveBeenCalledWith(browserStateRef.current);
    expect(typeof setBrowserState.mock.calls[0]?.[0]).not.toBe("function");
  });
});
