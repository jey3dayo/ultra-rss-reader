import { act, cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBrowserWebviewLoadTimeout } from "@/components/reader/hooks/browser/use-browser-webview-load-timeout";
import { BROWSER_WINDOW_LOAD_TIMEOUT_MS } from "@/constants/browser";
import { useUiStore } from "@/stores/ui-store";

setupBrowserTestDom();

describe("useBrowserWebviewLoadTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUiStore.setState({ browserUrl: "https://example.com/article" });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
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
      message: "Timed out waiting for embedded browser webview to finish loading.",
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

  it("uses a generic timeout surface detail without exposing the requested URL", () => {
    const requestedUrl = "https://example.com/private-token";
    const showSurfaceFailure = vi.fn();
    useUiStore.setState({ browserUrl: requestedUrl });

    renderHook(() => {
      useBrowserWebviewLoadTimeout({
        browserUrl: requestedUrl,
        isLoading: true,
        isStillLoading: () => true,
        showSurfaceFailure,
      });
    });

    act(() => {
      vi.advanceTimersByTime(BROWSER_WINDOW_LOAD_TIMEOUT_MS);
    });

    expect(showSurfaceFailure).toHaveBeenCalledWith({
      type: "UserVisible",
      message: "Timed out waiting for embedded browser webview to finish loading.",
    });
    expect(showSurfaceFailure.mock.calls[0]?.[0].message).not.toContain(requestedUrl);
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

  it("keeps loading state quiet when timeout scheduling fails", () => {
    const error = new Error("timer unavailable");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(window, "setTimeout").mockImplementation(() => {
      throw error;
    });
    const showSurfaceFailure = vi.fn();

    expect(() => {
      renderHook(() =>
        useBrowserWebviewLoadTimeout({
          browserUrl: "https://example.com/article",
          isLoading: true,
          isStillLoading: () => true,
          showSurfaceFailure,
        }),
      );
    }).not.toThrow();

    expect(showSurfaceFailure).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("Failed to schedule browser webview load timeout.", error);
  });

  it("logs timeout cleanup failures without throwing on unmount", () => {
    const error = new Error("clear failed");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(window, "clearTimeout").mockImplementation(() => {
      throw error;
    });
    const showSurfaceFailure = vi.fn();

    const { unmount } = renderHook(() =>
      useBrowserWebviewLoadTimeout({
        browserUrl: "https://example.com/article",
        isLoading: true,
        isStillLoading: () => true,
        showSurfaceFailure,
      }),
    );

    expect(() => unmount()).not.toThrow();
    expect(warn).toHaveBeenCalledWith("Failed to clear browser webview load timeout.", error);
  });
});
