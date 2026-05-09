import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError, BrowserWebviewState } from "@/api/tauri-commands";
import { useBrowserViewSurfaceState } from "@/components/reader/hooks/browser/use-browser-view-surface-state";

const labels = {
  browserMode: "Embedded preview isn't available in browser mode.",
  browserModeHint: "Use the desktop app for the native preview, or open this page in your external browser.",
  failed: "Web Preview couldn't load.",
  failedHint: "Try again, or open this page in your external browser.",
  blocked: "This page can't be shown in the in-app browser.",
  blockedHint: "Open it in your external browser instead.",
};

function createLoadingState(): BrowserWebviewState {
  return {
    url: "https://example.com/article",
    can_go_back: false,
    can_go_forward: false,
    is_loading: true,
    load_generation: 1,
  };
}

function createReadyState(url = "https://example.com/article"): BrowserWebviewState {
  return {
    ...createLoadingState(),
    url,
    is_loading: false,
  };
}

function createError(message: string): AppError {
  return {
    type: "UserVisible",
    message,
  };
}

describe("useBrowserViewSurfaceState", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("only exposes the runtime-unavailable issue after loading settles", () => {
    const onCloseOverlay = vi.fn();
    const { result, rerender } = renderHook(
      ({ isLoading }) => {
        const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createLoadingState());
        const browserStateRef = useRef(browserState);
        browserStateRef.current = browserState;
        const fallbackInFlightRef = useRef(false);

        const hook = useBrowserViewSurfaceState({
          browserStateRef,
          fallbackInFlightRef,
          isLoading,
          runtimeUnavailable: true,
          onCloseOverlay,
          setBrowserState,
          ...labels,
        });

        return { ...hook, browserState };
      },
      { initialProps: { isLoading: true } },
    );

    expect(result.current.activeSurfaceIssue).toBeNull();

    rerender({ isLoading: false });

    expect(result.current.activeSurfaceIssue).toEqual({
      kind: "unsupported",
      title: labels.browserMode,
      description: labels.browserModeHint,
      detail: null,
      canRetry: false,
    });
  });

  it("shows a surface failure and marks the browser state as no longer loading", () => {
    const onCloseOverlay = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createLoadingState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      const hook = useBrowserViewSurfaceState({
        browserStateRef,
        fallbackInFlightRef,
        isLoading: false,
        runtimeUnavailable: false,
        onCloseOverlay,
        setBrowserState,
        ...labels,
      });

      return { ...hook, browserState, fallbackInFlightRef };
    });

    act(() => {
      result.current.showSurfaceFailure(createError("first failure"));
    });

    expect(result.current.fallbackInFlightRef.current).toBe(true);
    expect(result.current.browserState).toEqual({
      ...createLoadingState(),
      is_loading: false,
    });
    expect(result.current.activeSurfaceIssue).toEqual({
      kind: "failed",
      title: labels.failed,
      description: labels.failedHint,
      detail: "first failure",
      canRetry: true,
    });
  });

  it("ignores duplicate surface failures while fallback handling is already in flight", () => {
    const onCloseOverlay = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createLoadingState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      const hook = useBrowserViewSurfaceState({
        browserStateRef,
        fallbackInFlightRef,
        isLoading: false,
        runtimeUnavailable: false,
        onCloseOverlay,
        setBrowserState,
        ...labels,
      });

      return { ...hook, browserState, fallbackInFlightRef };
    });

    act(() => {
      result.current.showSurfaceFailure(createError("first failure"));
    });

    act(() => {
      result.current.showSurfaceFailure(createError("second failure"));
    });

    expect(result.current.activeSurfaceIssue?.detail).toBe("first failure");
  });

  it("clears state and closes the overlay when the embedded webview disappears", () => {
    const onCloseOverlay = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createLoadingState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(true);

      const hook = useBrowserViewSurfaceState({
        browserStateRef,
        fallbackInFlightRef,
        isLoading: false,
        runtimeUnavailable: false,
        onCloseOverlay,
        setBrowserState,
        ...labels,
      });

      return { ...hook, browserState, fallbackInFlightRef };
    });

    act(() => {
      result.current.showSurfaceFailure(createError("lost before close"));
    });

    act(() => {
      result.current.handleLostEmbeddedBrowserWebview(createError("Embedded browser webview is not open"));
    });

    expect(result.current.browserState).toBeNull();
    expect(result.current.fallbackInFlightRef.current).toBe(false);
    expect(result.current.surfaceIssue).toBeNull();
    expect(result.current.activeSurfaceIssue).toBeNull();
    expect(onCloseOverlay).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      "Embedded browser webview disappeared while overlay was open:",
      "Embedded browser webview is not open",
    );
  });

  it("turns fallback payloads into surface issues and stops the loading state", () => {
    const onCloseOverlay = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createLoadingState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      const hook = useBrowserViewSurfaceState({
        browserStateRef,
        fallbackInFlightRef,
        isLoading: false,
        runtimeUnavailable: false,
        onCloseOverlay,
        setBrowserState,
        ...labels,
      });

      return { ...hook, browserState };
    });

    act(() => {
      result.current.handleBrowserWebviewFallback({
        url: "https://example.com/article",
        opened_external: false,
        error_message: null,
      });
    });

    expect(result.current.browserState).toEqual({
      ...createLoadingState(),
      is_loading: false,
    });
    expect(result.current.activeSurfaceIssue).toEqual({
      kind: "unsupported",
      title: labels.blocked,
      description: labels.blockedHint,
      detail: null,
      canRetry: false,
    });
  });

  it("resets failed and blocked issues when the browser URL changes", () => {
    const onCloseOverlay = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createReadyState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      const hook = useBrowserViewSurfaceState({
        browserStateRef,
        fallbackInFlightRef,
        isLoading: false,
        runtimeUnavailable: false,
        onCloseOverlay,
        setBrowserState,
        ...labels,
      });

      return { ...hook, browserState, setBrowserState, fallbackInFlightRef };
    });

    act(() => {
      result.current.showSurfaceFailure(createError("load failed"));
    });
    expect(result.current.activeSurfaceIssue?.kind).toBe("failed");
    expect(result.current.fallbackInFlightRef.current).toBe(true);

    act(() => {
      result.current.setBrowserState(createReadyState("https://example.com/next"));
    });

    expect(result.current.activeSurfaceIssue).toBeNull();
    expect(result.current.fallbackInFlightRef.current).toBe(false);

    act(() => {
      result.current.handleBrowserWebviewFallback({
        url: "https://example.com/next",
        opened_external: false,
        error_message: null,
      });
    });
    expect(result.current.activeSurfaceIssue?.kind).toBe("unsupported");

    act(() => {
      result.current.setBrowserState(createReadyState("https://example.com/third"));
    });

    expect(result.current.activeSurfaceIssue).toBeNull();
  });

  it("resets explicit issues when the browser closes", () => {
    const onCloseOverlay = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createReadyState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      const hook = useBrowserViewSurfaceState({
        browserStateRef,
        fallbackInFlightRef,
        isLoading: false,
        runtimeUnavailable: false,
        onCloseOverlay,
        setBrowserState,
        ...labels,
      });

      return { ...hook, setBrowserState, fallbackInFlightRef };
    });

    act(() => {
      result.current.showSurfaceFailure(createError("load failed"));
    });
    expect(result.current.activeSurfaceIssue?.kind).toBe("failed");

    act(() => {
      result.current.setBrowserState(null);
    });

    expect(result.current.activeSurfaceIssue).toBeNull();
    expect(result.current.fallbackInFlightRef.current).toBe(false);
  });

  it("resets retryable issues when a retry finishes successfully", () => {
    const onCloseOverlay = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createReadyState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      const hook = useBrowserViewSurfaceState({
        browserStateRef,
        fallbackInFlightRef,
        isLoading: false,
        runtimeUnavailable: false,
        onCloseOverlay,
        setBrowserState,
        ...labels,
      });

      return { ...hook, setBrowserState, fallbackInFlightRef };
    });

    act(() => {
      result.current.showSurfaceFailure(createError("load failed"));
    });
    expect(result.current.activeSurfaceIssue?.kind).toBe("failed");

    act(() => {
      result.current.setBrowserState(createLoadingState());
    });

    expect(result.current.activeSurfaceIssue?.kind).toBe("failed");

    act(() => {
      result.current.setBrowserState(createReadyState());
    });

    expect(result.current.activeSurfaceIssue).toBeNull();
    expect(result.current.fallbackInFlightRef.current).toBe(false);
  });

  it("keeps explicit issues across rerenders without a browser state transition", () => {
    const onCloseOverlay = vi.fn();
    const { result, rerender } = renderHook(
      ({ isLoading }) => {
        const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createReadyState());
        const browserStateRef = useRef(browserState);
        browserStateRef.current = browserState;
        const fallbackInFlightRef = useRef(false);

        const hook = useBrowserViewSurfaceState({
          browserStateRef,
          fallbackInFlightRef,
          isLoading,
          runtimeUnavailable: false,
          onCloseOverlay,
          setBrowserState,
          ...labels,
        });

        return { ...hook, fallbackInFlightRef };
      },
      { initialProps: { isLoading: false } },
    );

    act(() => {
      result.current.showSurfaceFailure(createError("load failed"));
    });

    rerender({ isLoading: false });

    expect(result.current.activeSurfaceIssue).toEqual({
      kind: "failed",
      title: labels.failed,
      description: labels.failedHint,
      detail: "load failed",
      canRetry: true,
    });
    expect(result.current.fallbackInFlightRef.current).toBe(true);
  });

  it("resets the runtime unavailable issue when loading restarts or runtime becomes available", () => {
    const onCloseOverlay = vi.fn();
    const { result, rerender } = renderHook(
      ({ isLoading, runtimeUnavailable }) => {
        const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createReadyState());
        const browserStateRef = useRef(browserState);
        browserStateRef.current = browserState;
        const fallbackInFlightRef = useRef(false);

        const hook = useBrowserViewSurfaceState({
          browserStateRef,
          fallbackInFlightRef,
          isLoading,
          runtimeUnavailable,
          onCloseOverlay,
          setBrowserState,
          ...labels,
        });

        return { ...hook };
      },
      { initialProps: { isLoading: false, runtimeUnavailable: true } },
    );

    expect(result.current.activeSurfaceIssue?.kind).toBe("unsupported");

    rerender({ isLoading: true, runtimeUnavailable: true });
    expect(result.current.activeSurfaceIssue).toBeNull();

    rerender({ isLoading: false, runtimeUnavailable: true });
    expect(result.current.activeSurfaceIssue?.kind).toBe("unsupported");

    rerender({ isLoading: false, runtimeUnavailable: false });
    expect(result.current.activeSurfaceIssue).toBeNull();
  });
});
