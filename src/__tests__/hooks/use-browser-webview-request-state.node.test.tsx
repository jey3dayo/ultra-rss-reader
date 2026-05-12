import { cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { useBrowserWebviewRequestState } from "@/components/reader/hooks/browser/use-browser-webview-request-state";

setupBrowserTestDom();

afterEach(() => {
  cleanup();
});

function createBrowserState(url: string, isLoading = false, loadGeneration = 1): BrowserWebviewState {
  return {
    url,
    can_go_back: false,
    can_go_forward: false,
    is_loading: isLoading,
    load_generation: loadGeneration,
  };
}

describe("useBrowserWebviewRequestState", () => {
  it("resets sync state and initializes a new browser request", () => {
    const resetBrowserWebviewSyncState = vi.fn();
    const clearSurfaceIssue = vi.fn();

    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(null);
      const browserStateRef = useRef<BrowserWebviewState | null>(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(true);

      useBrowserWebviewRequestState({
        browserUrl: "https://example.com/article",
        browserStateRef,
        fallbackInFlightRef,
        resetBrowserWebviewSyncState,
        setBrowserState,
        clearSurfaceIssue,
      });

      return { browserState, browserStateRef, fallbackInFlightRef };
    });

    expect(resetBrowserWebviewSyncState).toHaveBeenCalledTimes(1);
    expect(clearSurfaceIssue).toHaveBeenCalledTimes(1);
    expect(result.current.fallbackInFlightRef.current).toBe(false);
    expect(result.current.browserState).toEqual(createBrowserState("https://example.com/article", true, 0));
    expect(result.current.browserStateRef.current).toEqual(createBrowserState("https://example.com/article", true, 0));
  });

  it("keeps the existing browser state when the requested url is unchanged", () => {
    const resetBrowserWebviewSyncState = vi.fn();
    const clearSurfaceIssue = vi.fn();
    const initialState = createBrowserState("https://example.com/article", false);

    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(initialState);
      const browserStateRef = useRef<BrowserWebviewState | null>(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      useBrowserWebviewRequestState({
        browserUrl: "https://example.com/article",
        browserStateRef,
        fallbackInFlightRef,
        resetBrowserWebviewSyncState,
        setBrowserState,
        clearSurfaceIssue,
      });

      return { browserState };
    });

    expect(result.current.browserState).toBe(initialState);
  });

  it("starts a new same-url request generation after close and reopen", () => {
    const resetBrowserWebviewSyncState = vi.fn();
    const clearSurfaceIssue = vi.fn();
    const initialState = createBrowserState("https://example.com/article", false, 2);

    const { result, rerender } = renderHook(
      ({ browserUrl }) => {
        const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(initialState);
        const browserStateRef = useRef<BrowserWebviewState | null>(browserState);
        browserStateRef.current = browserState;
        const fallbackInFlightRef = useRef(false);

        useBrowserWebviewRequestState({
          browserUrl,
          browserStateRef,
          fallbackInFlightRef,
          resetBrowserWebviewSyncState,
          setBrowserState,
          clearSurfaceIssue,
        });

        return { browserState, browserStateRef };
      },
      { initialProps: { browserUrl: "https://example.com/article" as string | null } },
    );

    rerender({ browserUrl: null });
    rerender({ browserUrl: "https://example.com/article" });

    expect(result.current.browserState).toEqual(createBrowserState("https://example.com/article", true, 3));
    expect(result.current.browserStateRef.current).toEqual(createBrowserState("https://example.com/article", true, 3));
  });

  it("only clears retry state when the browser url is missing", () => {
    const resetBrowserWebviewSyncState = vi.fn();
    const clearSurfaceIssue = vi.fn();
    const initialState = createBrowserState("https://example.com/article", false);

    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(initialState);
      const browserStateRef = useRef<BrowserWebviewState | null>(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(true);

      useBrowserWebviewRequestState({
        browserUrl: null,
        browserStateRef,
        fallbackInFlightRef,
        resetBrowserWebviewSyncState,
        setBrowserState,
        clearSurfaceIssue,
      });

      return { browserState, fallbackInFlightRef };
    });

    expect(resetBrowserWebviewSyncState).toHaveBeenCalledTimes(1);
    expect(clearSurfaceIssue).not.toHaveBeenCalled();
    expect(result.current.fallbackInFlightRef.current).toBe(false);
    expect(result.current.browserState).toBe(initialState);
  });
});
