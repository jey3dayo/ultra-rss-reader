import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBrowserWebviewLoadTimeout } from "@/components/reader/hooks/browser/use-browser-webview-load-timeout";
import { BROWSER_WINDOW_LOAD_TIMEOUT_MS } from "@/constants/browser";
import { useUiStore } from "@/stores/ui-store";

describe("useBrowserWebviewLoadTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUiStore.setState({ browserUrl: "https://example.com/article" });
  });

  afterEach(() => {
    vi.useRealTimers();
    useUiStore.setState({ browserUrl: null });
  });

  it("shows a timeout failure only while the same URL is still loading", () => {
    const showSurfaceFailure = vi.fn();
    const props = {
      browserUrl: "https://example.com/article",
      isLoading: true,
      isStillLoading: () => true,
      showSurfaceFailure,
    };

    renderHook(
      (currentProps) => {
        useBrowserWebviewLoadTimeout(currentProps);
      },
      { initialProps: props },
    );

    act(() => {
      vi.advanceTimersByTime(BROWSER_WINDOW_LOAD_TIMEOUT_MS - 1);
    });
    expect(showSurfaceFailure).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(showSurfaceFailure).toHaveBeenCalledWith({
      type: "UserVisible",
      message:
        "Timed out waiting for embedded browser webview to finish loading: https://example.com/article",
    });

    showSurfaceFailure.mockClear();
    renderHook(() => {
      useBrowserWebviewLoadTimeout({
        browserUrl: "https://example.com/article",
        isLoading: true,
        isStillLoading: () => false,
        showSurfaceFailure,
      });
    });

    act(() => {
      vi.advanceTimersByTime(BROWSER_WINDOW_LOAD_TIMEOUT_MS);
    });
    expect(showSurfaceFailure).not.toHaveBeenCalled();
  });

  it("clears the timeout when loading completes before the timeout threshold", () => {
    const showSurfaceFailure = vi.fn();
    const { rerender } = renderHook(
      ({ isLoading }) => {
        useBrowserWebviewLoadTimeout({
          browserUrl: "https://example.com/article",
          isLoading,
          isStillLoading: () => true,
          showSurfaceFailure,
        });
      },
      { initialProps: { isLoading: true } },
    );

    rerender({ isLoading: false });

    act(() => {
      vi.advanceTimersByTime(BROWSER_WINDOW_LOAD_TIMEOUT_MS);
    });
    expect(showSurfaceFailure).not.toHaveBeenCalled();
  });

  it("does not show a timeout failure after the requested URL changes or the hook unmounts", () => {
    const showSurfaceFailure = vi.fn();
    const { unmount } = renderHook(() =>
      useBrowserWebviewLoadTimeout({
        browserUrl: "https://example.com/article",
        isLoading: true,
        isStillLoading: () => true,
        showSurfaceFailure,
      }),
    );

    useUiStore.setState({ browserUrl: "https://example.com/next" });

    act(() => {
      vi.advanceTimersByTime(BROWSER_WINDOW_LOAD_TIMEOUT_MS);
    });
    expect(showSurfaceFailure).not.toHaveBeenCalled();

    useUiStore.setState({ browserUrl: "https://example.com/article" });
    unmount();

    act(() => {
      vi.advanceTimersByTime(BROWSER_WINDOW_LOAD_TIMEOUT_MS);
    });
    expect(showSurfaceFailure).not.toHaveBeenCalled();
  });
});
