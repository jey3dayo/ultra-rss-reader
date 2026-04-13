import { renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { useBrowserWebviewRequestState } from "@/components/reader/use-browser-webview-request-state";

function createBrowserState(url: string, isLoading = false): BrowserWebviewState {
  return {
    url,
    can_go_back: false,
    can_go_forward: false,
    is_loading: isLoading,
  };
}

describe("useBrowserWebviewRequestState", () => {
  it("resets sync state and initializes a new browser request", () => {
    const resetBrowserWebviewSyncState = vi.fn();
    const setSurfaceIssue = vi.fn();

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
        setSurfaceIssue,
      });

      return { browserState, browserStateRef, fallbackInFlightRef };
    });

    expect(resetBrowserWebviewSyncState).toHaveBeenCalledTimes(1);
    expect(setSurfaceIssue).toHaveBeenCalledWith(null);
    expect(result.current.fallbackInFlightRef.current).toBe(false);
    expect(result.current.browserState).toEqual(createBrowserState("https://example.com/article", true));
    expect(result.current.browserStateRef.current).toEqual(createBrowserState("https://example.com/article", true));
  });

  it("keeps the existing browser state when the requested url is unchanged", () => {
    const resetBrowserWebviewSyncState = vi.fn();
    const setSurfaceIssue = vi.fn();
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
        setSurfaceIssue,
      });

      return { browserState };
    });

    expect(result.current.browserState).toBe(initialState);
  });

  it("only clears retry state when the browser url is missing", () => {
    const resetBrowserWebviewSyncState = vi.fn();
    const setSurfaceIssue = vi.fn();
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
        setSurfaceIssue,
      });

      return { browserState, fallbackInFlightRef };
    });

    expect(resetBrowserWebviewSyncState).toHaveBeenCalledTimes(1);
    expect(setSurfaceIssue).not.toHaveBeenCalled();
    expect(result.current.fallbackInFlightRef.current).toBe(false);
    expect(result.current.browserState).toBe(initialState);
  });
});
