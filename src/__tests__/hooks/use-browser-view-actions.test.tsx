import { Result } from "@praha/byethrow";
import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { useBrowserViewActions } from "@/components/reader/use-browser-view-actions";

const { goBackBrowserWebviewMock, goForwardBrowserWebviewMock, reloadBrowserWebviewMock } = vi.hoisted(() => ({
  goBackBrowserWebviewMock: vi.fn(),
  goForwardBrowserWebviewMock: vi.fn(),
  reloadBrowserWebviewMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  goBackBrowserWebview: goBackBrowserWebviewMock,
  goForwardBrowserWebview: goForwardBrowserWebviewMock,
  reloadBrowserWebview: reloadBrowserWebviewMock,
}));

function createBrowserState(overrides?: Partial<BrowserWebviewState>): BrowserWebviewState {
  return {
    url: "https://example.com/article",
    can_go_back: true,
    can_go_forward: false,
    is_loading: false,
    ...overrides,
  };
}

function createInitialBrowserState(url: string): BrowserWebviewState {
  return {
    url,
    can_go_back: false,
    can_go_forward: false,
    is_loading: true,
  };
}

describe("useBrowserViewActions", () => {
  beforeEach(() => {
    goBackBrowserWebviewMock.mockReset();
    goForwardBrowserWebviewMock.mockReset();
    reloadBrowserWebviewMock.mockReset();
  });

  it("recreates the embedded webview when back navigation reports that it is missing", async () => {
    goBackBrowserWebviewMock.mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "Embedded browser webview is not open",
      }),
    );

    const resetBrowserWebviewSyncState = vi.fn();
    const setSurfaceIssue = vi.fn();
    const showToast = vi.fn();
    const syncBrowserWebview = vi.fn(async () => {});

    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(createBrowserState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      const actions = useBrowserViewActions({
        browserUrl: "https://example.com/article",
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState,
        setSurfaceIssue,
        showToast,
        syncBrowserWebview,
        initialBrowserState: createInitialBrowserState,
        fallbackInFlightRef,
      });

      return { ...actions, browserState, fallbackInFlightRef };
    });

    await act(async () => {
      await result.current.handleGoBack();
    });

    expect(resetBrowserWebviewSyncState).toHaveBeenCalledTimes(1);
    expect(setSurfaceIssue).toHaveBeenCalledWith(null);
    expect(syncBrowserWebview).toHaveBeenCalledWith("https://example.com/article", "create");
    expect(result.current.browserState).toEqual(
      createBrowserState({
        can_go_back: false,
        can_go_forward: false,
        is_loading: true,
      }),
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  it("shows a toast for non-recoverable reload failures", async () => {
    reloadBrowserWebviewMock.mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "Reload failed",
      }),
    );

    const showToast = vi.fn();

    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(createBrowserState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      return useBrowserViewActions({
        browserUrl: "https://example.com/article",
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState: vi.fn(),
        setSurfaceIssue: vi.fn(),
        showToast,
        syncBrowserWebview: vi.fn(async () => {}),
        initialBrowserState: createInitialBrowserState,
        fallbackInFlightRef,
      });
    });

    await act(async () => {
      await result.current.handleReload();
    });

    expect(showToast).toHaveBeenCalledWith("Reload failed");
  });
});
