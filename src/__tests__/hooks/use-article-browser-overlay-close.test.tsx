import { Result } from "@praha/byethrow";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeBrowserWebview } from "@/api/tauri-commands";
import { useArticleBrowserOverlayClose } from "@/components/reader/hooks/article/use-article-browser-overlay-close";
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
});
