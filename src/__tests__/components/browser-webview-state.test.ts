import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  initialBrowserState,
  isMissingEmbeddedBrowserWebviewError,
  mergeBrowserState,
  resolveBrowserStateForRequestedUrl,
  setBrowserStateWithRef,
  updateBrowserStateWithRef,
} from "@/components/reader/browser-webview-state";
import { useUiStore } from "@/stores/ui-store";

describe("browser-webview-state", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

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

  it("keeps the ref, React state, and navigation store in sync when setting a loading state", () => {
    const browserStateRef = {
      current: null,
    };
    const setBrowserState = vi.fn();
    const nextState = {
      url: "https://example.com/loading",
      can_go_back: false,
      can_go_forward: true,
      is_loading: true,
    };

    setBrowserStateWithRef(browserStateRef, setBrowserState, nextState);

    expect(browserStateRef.current).toBe(nextState);
    expect(setBrowserState).toHaveBeenCalledWith(nextState);
    expect(useUiStore.getState().browserNavigationState).toEqual({
      canGoBack: false,
      canGoForward: true,
    });
  });

  it("clears the ref, React state, and navigation store when setting a null state", () => {
    useUiStore.getState().setBrowserNavigationState({
      canGoBack: true,
      canGoForward: true,
    });
    const browserStateRef = {
      current: {
        url: "https://example.com/current",
        can_go_back: true,
        can_go_forward: true,
        is_loading: false,
      },
    };
    const setBrowserState = vi.fn();

    setBrowserStateWithRef(browserStateRef, setBrowserState, null);

    expect(browserStateRef.current).toBeNull();
    expect(setBrowserState).toHaveBeenCalledWith(null);
    expect(useUiStore.getState().browserNavigationState).toBeNull();
  });
});
