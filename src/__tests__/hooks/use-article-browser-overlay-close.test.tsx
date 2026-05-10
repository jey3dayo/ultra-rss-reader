import { Result } from "@praha/byethrow";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeBrowserWebview } from "@/api/tauri-commands";
import { useArticleBrowserOverlayClose } from "@/components/reader/hooks/article/use-article-browser-overlay-close";
import { APP_EVENTS } from "@/constants/events";
import { BROWSER_OVERLAY_CLOSE_DELAY_MS } from "@/constants/motion";
import { useUiStore } from "@/stores/ui-store";

vi.mock("@/api/tauri-commands", () => ({
  closeBrowserWebview: vi.fn(),
}));

const closeBrowserWebviewMock = vi.mocked(closeBrowserWebview);

describe("useArticleBrowserOverlayClose", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      window.setTimeout(() => callback(performance.now()), 0);
      return 0;
    });
    useUiStore.setState(useUiStore.getInitialState());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.clearAllMocks();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("does not execute closeBrowserWebview twice while close is in flight", async () => {
    let resolveClose: (value: Result.Result<null, { type: "UserVisible"; message: string }>) => void = () => {};
    closeBrowserWebviewMock.mockReturnValue(
      new Promise((resolve) => {
        resolveClose = resolve;
      }),
    );
    const originalSetFocusedPane = useUiStore.getState().setFocusedPane;
    const setFocusedPane = vi.fn((pane: "sidebar" | "list" | "content") => originalSetFocusedPane(pane));
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserCloseInFlight: false,
      setFocusedPane,
    });
    const closeBrowser = vi.fn(() => useUiStore.getState().setBrowserCloseInFlight(false));
    const focusSelectedArticleRow = vi.fn();
    const setBrowserOverlayClosedPreference = vi.fn();

    const { result } = renderHook(() =>
      useArticleBrowserOverlayClose({
        closeBrowser,
        focusSelectedArticleRow,
        setBrowserCloseInFlight: useUiStore.getState().setBrowserCloseInFlight,
        setBrowserOverlayClosedPreference,
      }),
    );

    act(() => {
      result.current();
      result.current();
    });

    expect(closeBrowserWebviewMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveClose(Result.succeed(null));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(BROWSER_OVERLAY_CLOSE_DELAY_MS);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(setFocusedPane).toHaveBeenCalledTimes(1);
    expect(setFocusedPane).toHaveBeenCalledWith("list");
    expect(setBrowserOverlayClosedPreference).toHaveBeenCalledTimes(1);
    expect(closeBrowser).toHaveBeenCalledTimes(1);
  });

  it("logs Result.fail and still returns to reader mode", async () => {
    const closeError = {
      type: "UserVisible" as const,
      message: "close failed",
    };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    closeBrowserWebviewMock.mockResolvedValue(Result.fail(closeError));
    const originalSetFocusedPane = useUiStore.getState().setFocusedPane;
    const setFocusedPane = vi.fn((pane: "sidebar" | "list" | "content") => originalSetFocusedPane(pane));
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserCloseInFlight: false,
      setFocusedPane,
    });
    const closeBrowser = vi.fn(() => useUiStore.getState().setBrowserCloseInFlight(false));
    const focusSelectedArticleRow = vi.fn();
    const setBrowserOverlayClosedPreference = vi.fn();

    const { result } = renderHook(() =>
      useArticleBrowserOverlayClose({
        closeBrowser,
        focusSelectedArticleRow,
        setBrowserCloseInFlight: useUiStore.getState().setBrowserCloseInFlight,
        setBrowserOverlayClosedPreference,
      }),
    );

    act(() => {
      result.current();
    });

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(BROWSER_OVERLAY_CLOSE_DELAY_MS);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to close embedded browser webview before returning to reader mode:",
      closeError,
    );
    expect(setFocusedPane).toHaveBeenCalledWith("list");
    expect(setBrowserOverlayClosedPreference).toHaveBeenCalledTimes(1);
    expect(closeBrowser).toHaveBeenCalledTimes(1);
  });

  it("logs rejected close commands and still returns to reader mode", async () => {
    const error = new Error("runtime rejected");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    closeBrowserWebviewMock.mockRejectedValue(error);
    const originalSetFocusedPane = useUiStore.getState().setFocusedPane;
    const setFocusedPane = vi.fn((pane: "sidebar" | "list" | "content") => originalSetFocusedPane(pane));
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserCloseInFlight: false,
      setFocusedPane,
    });
    const closeBrowser = vi.fn(() => useUiStore.getState().setBrowserCloseInFlight(false));
    const focusSelectedArticleRow = vi.fn();
    const setBrowserOverlayClosedPreference = vi.fn();

    const { result } = renderHook(() =>
      useArticleBrowserOverlayClose({
        closeBrowser,
        focusSelectedArticleRow,
        setBrowserCloseInFlight: useUiStore.getState().setBrowserCloseInFlight,
        setBrowserOverlayClosedPreference,
      }),
    );

    act(() => {
      result.current();
    });

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(BROWSER_OVERLAY_CLOSE_DELAY_MS);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(consoleError).toHaveBeenCalledWith(
      "Embedded browser webview close command rejected before returning to reader mode:",
      error,
    );
    expect(setFocusedPane).toHaveBeenCalledWith("list");
    expect(setBrowserOverlayClosedPreference).toHaveBeenCalledTimes(1);
    expect(closeBrowser).toHaveBeenCalledTimes(1);
  });

  it("does not finalize a pending close motion after unmount", async () => {
    let resolveClose: (value: Result.Result<null, { type: "UserVisible"; message: string }>) => void = () => {};
    closeBrowserWebviewMock.mockReturnValue(
      new Promise((resolve) => {
        resolveClose = resolve;
      }),
    );
    const originalSetFocusedPane = useUiStore.getState().setFocusedPane;
    const setFocusedPane = vi.fn((pane: "sidebar" | "list" | "content") => originalSetFocusedPane(pane));
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserCloseInFlight: false,
      setFocusedPane,
    });
    const closeBrowser = vi.fn(() => useUiStore.getState().setBrowserCloseInFlight(false));
    const focusSelectedArticleRow = vi.fn();
    const setBrowserOverlayClosedPreference = vi.fn();

    const { result, unmount } = renderHook(() =>
      useArticleBrowserOverlayClose({
        closeBrowser,
        focusSelectedArticleRow,
        setBrowserCloseInFlight: useUiStore.getState().setBrowserCloseInFlight,
        setBrowserOverlayClosedPreference,
      }),
    );

    act(() => {
      result.current();
    });

    unmount();

    await act(async () => {
      resolveClose(Result.succeed(null));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(BROWSER_OVERLAY_CLOSE_DELAY_MS);
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(setFocusedPane).not.toHaveBeenCalled();
    expect(setBrowserOverlayClosedPreference).not.toHaveBeenCalled();
    expect(closeBrowser).not.toHaveBeenCalled();
  });

  it("finalizes the overlay close when the close motion timer is unavailable", async () => {
    const error = new Error("timer unavailable");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(window, "setTimeout").mockImplementation(() => {
      throw error;
    });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(performance.now());
      return 0;
    });
    closeBrowserWebviewMock.mockResolvedValue(Result.succeed(null));
    const originalSetFocusedPane = useUiStore.getState().setFocusedPane;
    const setFocusedPane = vi.fn((pane: "sidebar" | "list" | "content") => originalSetFocusedPane(pane));
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserCloseInFlight: false,
      setFocusedPane,
    });
    const closeBrowser = vi.fn(() => useUiStore.getState().setBrowserCloseInFlight(false));
    const focusSelectedArticleRow = vi.fn();
    const setBrowserOverlayClosedPreference = vi.fn();

    const { result } = renderHook(() =>
      useArticleBrowserOverlayClose({
        closeBrowser,
        focusSelectedArticleRow,
        setBrowserCloseInFlight: useUiStore.getState().setBrowserCloseInFlight,
        setBrowserOverlayClosedPreference,
      }),
    );

    act(() => {
      result.current();
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(warn).toHaveBeenCalledWith("Failed to schedule browser overlay close motion timer.", error);
    expect(setFocusedPane).toHaveBeenCalledWith("list");
    expect(setBrowserOverlayClosedPreference).toHaveBeenCalledTimes(1);
    expect(closeBrowser).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["unavailable", () => undefined],
    [
      "throwing",
      () => {
        const error = new Error("frame unavailable");
        vi.stubGlobal("requestAnimationFrame", () => {
          throw error;
        });
        return error;
      },
    ],
  ])("finalizes pending close actions when requestAnimationFrame is %s", async (_label, setupFrameFailure) => {
    const frameError = setupFrameFailure();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    if (!frameError) {
      vi.stubGlobal("requestAnimationFrame", undefined);
    }
    closeBrowserWebviewMock.mockResolvedValue(Result.succeed(null));
    const navigateArticleSpy = vi.fn();
    window.addEventListener(APP_EVENTS.navigateArticle, navigateArticleSpy);
    const originalSetFocusedPane = useUiStore.getState().setFocusedPane;
    const setFocusedPane = vi.fn((pane: "sidebar" | "list" | "content") => originalSetFocusedPane(pane));
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserCloseInFlight: false,
      pendingBrowserCloseAction: "next-article",
      setFocusedPane,
    });
    const closeBrowser = vi.fn();
    const focusSelectedArticleRow = vi.fn();
    const setBrowserOverlayClosedPreference = vi.fn();

    const { result } = renderHook(() =>
      useArticleBrowserOverlayClose({
        closeBrowser,
        focusSelectedArticleRow,
        setBrowserCloseInFlight: useUiStore.getState().setBrowserCloseInFlight,
        setBrowserOverlayClosedPreference,
      }),
    );

    try {
      act(() => {
        result.current();
      });

      await act(async () => {
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(BROWSER_OVERLAY_CLOSE_DELAY_MS);
        await Promise.resolve();
        await vi.runOnlyPendingTimersAsync();
      });

      expect(setFocusedPane).toHaveBeenCalledWith("list");
      expect(focusSelectedArticleRow).toHaveBeenCalledTimes(2);
      expect(setBrowserOverlayClosedPreference).toHaveBeenCalledTimes(1);
      expect(closeBrowser).toHaveBeenCalledTimes(1);
      expect(navigateArticleSpy).toHaveBeenCalledOnce();
      expect(navigateArticleSpy.mock.calls[0]?.[0]).toMatchObject({
        detail: 1,
      });
      expect(useUiStore.getState().browserCloseInFlight).toBe(false);
      if (frameError) {
        expect(warn).toHaveBeenCalledWith("Failed to schedule reader focus frame.", frameError);
      }
    } finally {
      window.removeEventListener(APP_EVENTS.navigateArticle, navigateArticleSpy);
    }
  });

  it("logs close motion timer cleanup failures without finalizing after unmount", async () => {
    const error = new Error("clear unavailable");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(window, "clearTimeout").mockImplementation(() => {
      throw error;
    });
    closeBrowserWebviewMock.mockResolvedValue(Result.succeed(null));
    const originalSetFocusedPane = useUiStore.getState().setFocusedPane;
    const setFocusedPane = vi.fn((pane: "sidebar" | "list" | "content") => originalSetFocusedPane(pane));
    useUiStore.setState({
      selectedArticleId: "art-1",
      contentMode: "browser",
      browserCloseInFlight: false,
      setFocusedPane,
    });
    const closeBrowser = vi.fn(() => useUiStore.getState().setBrowserCloseInFlight(false));
    const focusSelectedArticleRow = vi.fn();
    const setBrowserOverlayClosedPreference = vi.fn();

    const { result, unmount } = renderHook(() =>
      useArticleBrowserOverlayClose({
        closeBrowser,
        focusSelectedArticleRow,
        setBrowserCloseInFlight: useUiStore.getState().setBrowserCloseInFlight,
        setBrowserOverlayClosedPreference,
      }),
    );

    act(() => {
      result.current();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(() => unmount()).not.toThrow();

    act(() => {
      vi.advanceTimersByTime(BROWSER_OVERLAY_CLOSE_DELAY_MS);
    });

    expect(warn).toHaveBeenCalledWith("Failed to clear browser overlay close motion timer.", error);
    expect(setFocusedPane).not.toHaveBeenCalled();
    expect(setBrowserOverlayClosedPreference).not.toHaveBeenCalled();
    expect(closeBrowser).not.toHaveBeenCalled();
  });
});
