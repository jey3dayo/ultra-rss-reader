import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { useBrowserWebviewStateChanged } from "@/components/reader/hooks/browser/use-browser-webview-state-changed";

function createState(url: string, isLoading: boolean): BrowserWebviewState {
  return {
    url,
    can_go_back: false,
    can_go_forward: false,
    is_loading: isLoading,
  };
}

describe("useBrowserWebviewStateChanged", () => {
  it("clears fallback recovery markers when a loading state change arrives", () => {
    const setSurfaceIssue = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() =>
        createState("https://example.com/old", false),
      );
      const browserStateRef = useRef<BrowserWebviewState | null>(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(true);

      const handleStateChanged = useBrowserWebviewStateChanged({
        browserStateRef,
        fallbackInFlightRef,
        setBrowserState,
        setSurfaceIssue,
        getRequestedUrl: () => "https://example.com/new",
      });

      return { browserState, browserStateRef, fallbackInFlightRef, handleStateChanged };
    });

    act(() => {
      result.current.handleStateChanged({
        url: "https://example.com/new",
        can_go_back: true,
        can_go_forward: false,
        is_loading: true,
      });
    });

    expect(result.current.browserState).toEqual({
      url: "https://example.com/old",
      can_go_back: true,
      can_go_forward: false,
      is_loading: false,
    });
    expect(result.current.browserStateRef.current).toEqual(result.current.browserState);
    expect(result.current.fallbackInFlightRef.current).toBe(false);
    expect(setSurfaceIssue).toHaveBeenCalledWith(null);
  });

  it("clears fallback recovery markers when a finished state change arrives", () => {
    const setSurfaceIssue = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() =>
        createState("https://example.com/loading", true),
      );
      const browserStateRef = useRef<BrowserWebviewState | null>(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(true);

      const handleStateChanged = useBrowserWebviewStateChanged({
        browserStateRef,
        fallbackInFlightRef,
        setBrowserState,
        setSurfaceIssue,
        getRequestedUrl: () => "https://example.com/finished",
      });

      return { browserState, browserStateRef, fallbackInFlightRef, handleStateChanged };
    });

    act(() => {
      result.current.handleStateChanged({
        url: "https://example.com/finished",
        can_go_back: true,
        can_go_forward: true,
        is_loading: false,
      });
    });

    expect(result.current.browserState).toEqual({
      url: "https://example.com/finished",
      can_go_back: true,
      can_go_forward: true,
      is_loading: false,
    });
    expect(result.current.browserStateRef.current).toEqual(result.current.browserState);
    expect(result.current.fallbackInFlightRef.current).toBe(false);
    expect(setSurfaceIssue).toHaveBeenCalledWith(null);
  });
});
