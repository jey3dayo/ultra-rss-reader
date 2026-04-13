import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError, BrowserWebviewState } from "@/api/tauri-commands";
import { useBrowserViewSurfaceState } from "@/components/reader/use-browser-view-surface-state";

const labels = {
  browserMode: "Embedded preview isn't available in browser mode.",
  browserModeHint: "Use the desktop app for the native preview, or open this page in your external browser.",
  failed: "Web Preview couldn't load.",
  failedHint: "Try again, or open this page in your external browser.",
};

function createLoadingState(): BrowserWebviewState {
  return {
    url: "https://example.com/article",
    can_go_back: false,
    can_go_forward: false,
    is_loading: true,
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
        const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(createLoadingState());
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

  it("shows a surface failure once and marks the browser state as no longer loading", () => {
    const onCloseOverlay = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(createLoadingState());
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

    act(() => {
      result.current.showSurfaceFailure(createError("second failure"));
    });

    expect(result.current.activeSurfaceIssue?.detail).toBe("first failure");
  });

  it("clears state and closes the overlay when the embedded webview disappears", () => {
    const onCloseOverlay = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(createLoadingState());
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
    expect(result.current.activeSurfaceIssue).toBeNull();
    expect(onCloseOverlay).toHaveBeenCalledTimes(1);
  });
});
