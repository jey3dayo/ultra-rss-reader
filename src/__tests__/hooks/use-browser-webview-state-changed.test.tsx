import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { isBrowserWebviewFallbackForRequestedUrl } from "@/components/reader/browser-webview-state";
import { useBrowserWebviewStateChanged } from "@/components/reader/hooks/browser/use-browser-webview-state-changed";

function createState(url: string, isLoading: boolean): BrowserWebviewState {
  return {
    url,
    can_go_back: false,
    can_go_forward: false,
    is_loading: isLoading,
    load_generation: 1,
  };
}

describe("useBrowserWebviewStateChanged", () => {
  it("accepts fallback payloads only for the currently requested URL", () => {
    expect(
      isBrowserWebviewFallbackForRequestedUrl(
        {
          url: "https://example.com/current",
          opened_external: true,
          error_message: null,
        },
        "https://example.com/current",
      ),
    ).toBe(true);
    expect(
      isBrowserWebviewFallbackForRequestedUrl(
        {
          url: "https://example.com/previous",
          opened_external: true,
          error_message: null,
        },
        "https://example.com/current",
      ),
    ).toBe(false);
    expect(
      isBrowserWebviewFallbackForRequestedUrl(
        {
          url: "https://example.com/current",
          opened_external: true,
          error_message: null,
        },
        "",
      ),
    ).toBe(false);
  });

  it("clears fallback recovery markers when a loading state change arrives", () => {
    const clearSurfaceIssue = vi.fn();
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
        clearSurfaceIssue,
        getRequestedUrl: () => "https://example.com/new",
      });

      return {
        browserState,
        browserStateRef,
        fallbackInFlightRef,
        handleStateChanged,
      };
    });

    act(() => {
      result.current.handleStateChanged({
        url: "https://example.com/new",
        can_go_back: true,
        can_go_forward: false,
        is_loading: true,
        load_generation: 2,
      });
    });

    expect(result.current.browserState).toEqual({
      url: "https://example.com/old",
      can_go_back: true,
      can_go_forward: false,
      is_loading: false,
      load_generation: 1,
    });
    expect(result.current.browserStateRef.current).toEqual(result.current.browserState);
    expect(result.current.fallbackInFlightRef.current).toBe(false);
    expect(clearSurfaceIssue).toHaveBeenCalledTimes(1);
  });

  it("clears fallback recovery markers when a finished state change arrives", () => {
    const clearSurfaceIssue = vi.fn();
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
        clearSurfaceIssue,
        getRequestedUrl: () => "https://example.com/finished",
      });

      return {
        browserState,
        browserStateRef,
        fallbackInFlightRef,
        handleStateChanged,
      };
    });

    act(() => {
      result.current.handleStateChanged({
        url: "https://example.com/finished",
        can_go_back: true,
        can_go_forward: true,
        is_loading: false,
        load_generation: 2,
      });
    });

    expect(result.current.browserState).toEqual({
      url: "https://example.com/finished",
      can_go_back: true,
      can_go_forward: true,
      is_loading: false,
      load_generation: 2,
    });
    expect(result.current.browserStateRef.current).toEqual(result.current.browserState);
    expect(result.current.fallbackInFlightRef.current).toBe(false);
    expect(clearSurfaceIssue).toHaveBeenCalledTimes(1);
  });

  it("ignores a late finished state change for the previous request while the new request is loading", () => {
    const clearSurfaceIssue = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() =>
        createState("https://example.com/new", true),
      );
      const browserStateRef = useRef<BrowserWebviewState | null>(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      const handleStateChanged = useBrowserWebviewStateChanged({
        browserStateRef,
        fallbackInFlightRef,
        setBrowserState,
        clearSurfaceIssue,
        getRequestedUrl: () => "https://example.com/new",
      });

      return { browserState, browserStateRef, handleStateChanged };
    });

    act(() => {
      result.current.handleStateChanged({
        url: "https://example.com/old",
        can_go_back: true,
        can_go_forward: false,
        is_loading: false,
        load_generation: 1,
      });
    });

    expect(result.current.browserState).toEqual({
      url: "https://example.com/new",
      can_go_back: false,
      can_go_forward: false,
      is_loading: true,
      load_generation: 1,
    });
    expect(result.current.browserStateRef.current).toEqual(result.current.browserState);
    expect(clearSurfaceIssue).not.toHaveBeenCalled();
  });

  it("ignores state changes after the overlay has already closed", () => {
    const clearSurfaceIssue = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(null);
      const browserStateRef = useRef<BrowserWebviewState | null>(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(true);

      const handleStateChanged = useBrowserWebviewStateChanged({
        browserStateRef,
        fallbackInFlightRef,
        setBrowserState,
        clearSurfaceIssue,
        getRequestedUrl: () => "",
      });

      return { browserState, browserStateRef, fallbackInFlightRef, handleStateChanged };
    });

    act(() => {
      result.current.handleStateChanged({
        url: "https://example.com/closed",
        can_go_back: true,
        can_go_forward: true,
        is_loading: false,
        load_generation: 3,
      });
    });

    expect(result.current.browserState).toBeNull();
    expect(result.current.browserStateRef.current).toBeNull();
    expect(result.current.fallbackInFlightRef.current).toBe(true);
    expect(clearSurfaceIssue).not.toHaveBeenCalled();
  });

  it("ignores a late same-url state change from an older close-reopen generation", () => {
    const clearSurfaceIssue = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>({
        ...createState("https://example.com/article", true),
        load_generation: 3,
      });
      const browserStateRef = useRef<BrowserWebviewState | null>(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      const handleStateChanged = useBrowserWebviewStateChanged({
        browserStateRef,
        fallbackInFlightRef,
        setBrowserState,
        clearSurfaceIssue,
        getRequestedUrl: () => "https://example.com/article",
      });

      return { browserState, browserStateRef, handleStateChanged };
    });

    act(() => {
      result.current.handleStateChanged({
        url: "https://example.com/article",
        can_go_back: true,
        can_go_forward: true,
        is_loading: false,
        load_generation: 2,
      });
    });

    expect(result.current.browserState).toEqual({
      url: "https://example.com/article",
      can_go_back: false,
      can_go_forward: false,
      is_loading: true,
      load_generation: 3,
    });
    expect(result.current.browserStateRef.current).toEqual(result.current.browserState);
    expect(clearSurfaceIssue).not.toHaveBeenCalled();
  });

  it("treats a late loaded event as recovery after a load timeout surface failure", () => {
    const clearSurfaceIssue = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() =>
        createState("https://example.com/slow", true),
      );
      const browserStateRef = useRef<BrowserWebviewState | null>(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      const handleStateChanged = useBrowserWebviewStateChanged({
        browserStateRef,
        fallbackInFlightRef,
        setBrowserState,
        clearSurfaceIssue,
        getRequestedUrl: () => "https://example.com/slow",
      });

      return { browserState, browserStateRef, handleStateChanged };
    });

    act(() => {
      result.current.handleStateChanged({
        url: "https://example.com/slow",
        can_go_back: false,
        can_go_forward: true,
        is_loading: false,
        load_generation: 2,
      });
    });

    expect(result.current.browserState).toEqual({
      url: "https://example.com/slow",
      can_go_back: false,
      can_go_forward: true,
      is_loading: false,
      load_generation: 2,
    });
    expect(result.current.browserStateRef.current).toEqual(result.current.browserState);
    expect(clearSurfaceIssue).toHaveBeenCalledTimes(1);
  });
});
