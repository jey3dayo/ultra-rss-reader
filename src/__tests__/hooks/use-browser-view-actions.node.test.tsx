import { Result } from "@praha/byethrow";
import { act, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { useBrowserViewActions } from "@/components/reader/hooks/browser/use-browser-view-actions";

import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const {
  focusBrowserWebviewMock,
  goBackBrowserWebviewMock,
  goForwardBrowserWebviewMock,
  openUrlInExternalBrowserMock,
  reloadBrowserWebviewMock,
} = vi.hoisted(() => ({
  focusBrowserWebviewMock: vi.fn(),
  goBackBrowserWebviewMock: vi.fn(),
  goForwardBrowserWebviewMock: vi.fn(),
  openUrlInExternalBrowserMock: vi.fn(),
  reloadBrowserWebviewMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  focusBrowserWebview: focusBrowserWebviewMock,
  goBackBrowserWebview: goBackBrowserWebviewMock,
  goForwardBrowserWebview: goForwardBrowserWebviewMock,
  reloadBrowserWebview: reloadBrowserWebviewMock,
}));

vi.mock("@/components/reader/article-browser-actions", () => ({
  openUrlInExternalBrowser: openUrlInExternalBrowserMock,
}));

setupBrowserTestDom();

function createBrowserState(overrides?: Partial<BrowserWebviewState>): BrowserWebviewState {
  return {
    url: "https://example.com/article",
    can_go_back: true,
    can_go_forward: false,
    is_loading: false,
    load_generation: 1,
    ...overrides,
  };
}

function createInitialBrowserState(url: string): BrowserWebviewState {
  return {
    url,
    can_go_back: false,
    can_go_forward: false,
    is_loading: true,
    load_generation: 0,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return {
    promise,
    resolve: (value: T) => resolve(value),
    reject: (reason?: unknown) => reject(reason),
  };
}

describe("useBrowserViewActions", () => {
  beforeEach(() => {
    focusBrowserWebviewMock.mockReset();
    goBackBrowserWebviewMock.mockReset();
    goForwardBrowserWebviewMock.mockReset();
    openUrlInExternalBrowserMock.mockReset();
    reloadBrowserWebviewMock.mockReset();
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    useUiStore.setState(useUiStore.getInitialState());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("recreates the embedded webview when back navigation reports that it is missing", async () => {
    goBackBrowserWebviewMock.mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "Embedded browser webview is not open",
      }),
    );

    const resetBrowserWebviewSyncState = vi.fn();
    const clearSurfaceIssue = vi.fn();
    const showToast = vi.fn();
    const syncBrowserWebview = vi.fn(async () => {});

    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createBrowserState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      const actions = useBrowserViewActions({
        browserUrl: "https://example.com/article",
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState,
        clearSurfaceIssue,
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
    expect(clearSurfaceIssue).toHaveBeenCalledTimes(1);
    expect(syncBrowserWebview).toHaveBeenCalledWith("https://example.com/article", "create");
    expect(result.current.browserState).toEqual(
      createBrowserState({
        can_go_back: false,
        can_go_forward: false,
        is_loading: true,
        load_generation: 0,
      }),
    );
    expect(showToast).not.toHaveBeenCalled();
  });

  it("recreates the embedded webview from the fallback browser URL when reload reports that it is missing", async () => {
    reloadBrowserWebviewMock.mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "Embedded browser webview is not open",
      }),
    );

    const resetBrowserWebviewSyncState = vi.fn();
    const clearSurfaceIssue = vi.fn();
    const showToast = vi.fn();
    const syncBrowserWebview = vi.fn(async () => {});

    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(null);
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(true);

      const actions = useBrowserViewActions({
        browserUrl: "https://example.com/fallback",
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState,
        clearSurfaceIssue,
        showToast,
        syncBrowserWebview,
        initialBrowserState: createInitialBrowserState,
        fallbackInFlightRef,
      });

      return { ...actions, browserState, fallbackInFlightRef };
    });

    await act(async () => {
      await result.current.handleReload();
    });

    expect(result.current.fallbackInFlightRef.current).toBe(false);
    expect(resetBrowserWebviewSyncState).toHaveBeenCalledTimes(1);
    expect(clearSurfaceIssue).toHaveBeenCalledTimes(1);
    expect(syncBrowserWebview).toHaveBeenCalledWith("https://example.com/fallback", "create");
    expect(result.current.browserState).toEqual(createInitialBrowserState("https://example.com/fallback"));
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
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createBrowserState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      return useBrowserViewActions({
        browserUrl: "https://example.com/article",
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState: vi.fn(),
        clearSurfaceIssue: vi.fn(),
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

  it("restores webview focus after toolbar navigation when focus retention is enabled", async () => {
    usePreferencesStore.setState({ prefs: { web_preview_keep_focus: "true" }, loaded: true });
    reloadBrowserWebviewMock.mockResolvedValue(
      Result.succeed(
        createBrowserState({
          can_go_back: false,
          can_go_forward: false,
          is_loading: false,
        }),
      ),
    );
    focusBrowserWebviewMock.mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createBrowserState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      return useBrowserViewActions({
        browserUrl: "https://example.com/article",
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState: vi.fn(),
        clearSurfaceIssue: vi.fn(),
        showToast: vi.fn(),
        syncBrowserWebview: vi.fn(async () => {}),
        initialBrowserState: createInitialBrowserState,
        fallbackInFlightRef,
      });
    });

    await act(async () => {
      await result.current.handleReload();
    });

    expect(focusBrowserWebviewMock).toHaveBeenCalledTimes(1);
  });

  it("keeps successful browser state when focus restoration fails after toolbar navigation", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    usePreferencesStore.setState({ prefs: { web_preview_keep_focus: "true" }, loaded: true });
    const nextState = createBrowserState({
      url: "https://example.com/reloaded",
      can_go_back: false,
      can_go_forward: true,
      is_loading: false,
    });
    reloadBrowserWebviewMock.mockResolvedValue(Result.succeed(nextState));
    focusBrowserWebviewMock.mockResolvedValue(
      Result.fail({
        type: "UserVisible",
        message: "Focus failed",
      }),
    );
    const showToast = vi.fn();

    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createBrowserState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(true);

      const actions = useBrowserViewActions({
        browserUrl: "https://example.com/article",
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState: vi.fn(),
        clearSurfaceIssue: vi.fn(),
        showToast,
        syncBrowserWebview: vi.fn(async () => {}),
        initialBrowserState: createInitialBrowserState,
        fallbackInFlightRef,
      });

      return { ...actions, browserState, fallbackInFlightRef };
    });

    await act(async () => {
      await result.current.handleReload();
    });

    expect(result.current.browserState).toEqual(nextState);
    expect(result.current.fallbackInFlightRef.current).toBe(false);
    expect(focusBrowserWebviewMock).toHaveBeenCalledTimes(1);
    expect(showToast).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("Failed to restore embedded browser focus:", {
      type: "UserVisible",
      message: "Focus failed",
    });
  });

  it("does not restore webview focus after toolbar navigation when focus retention is disabled", async () => {
    reloadBrowserWebviewMock.mockResolvedValue(
      Result.succeed(
        createBrowserState({
          can_go_back: false,
          can_go_forward: false,
          is_loading: false,
        }),
      ),
    );
    focusBrowserWebviewMock.mockResolvedValue(Result.succeed(null));

    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createBrowserState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      return useBrowserViewActions({
        browserUrl: "https://example.com/article",
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState: vi.fn(),
        clearSurfaceIssue: vi.fn(),
        showToast: vi.fn(),
        syncBrowserWebview: vi.fn(async () => {}),
        initialBrowserState: createInitialBrowserState,
        fallbackInFlightRef,
      });
    });

    await act(async () => {
      await result.current.handleReload();
    });

    expect(focusBrowserWebviewMock).not.toHaveBeenCalled();
  });

  it("keeps native back and forward commands gated by current availability", async () => {
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() =>
        createBrowserState({
          can_go_back: false,
          can_go_forward: false,
        }),
      );
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      return useBrowserViewActions({
        browserUrl: "https://example.com/article",
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState: vi.fn(),
        clearSurfaceIssue: vi.fn(),
        showToast: vi.fn(),
        syncBrowserWebview: vi.fn(async () => {}),
        initialBrowserState: createInitialBrowserState,
        fallbackInFlightRef,
      });
    });

    await act(async () => {
      await result.current.handleGoBack();
      await result.current.handleGoForward();
    });

    expect(goBackBrowserWebviewMock).not.toHaveBeenCalled();
    expect(goForwardBrowserWebviewMock).not.toHaveBeenCalled();
  });

  it("ignores stale browser navigation command results after a newer command settles", async () => {
    const slowBack = deferred<Awaited<ReturnType<typeof goBackBrowserWebviewMock>>>();
    const fastBackState = createBrowserState({
      url: "https://example.com/fast-back",
      can_go_back: true,
      can_go_forward: true,
      load_generation: 2,
    });
    const slowBackState = createBrowserState({
      url: "https://example.com/slow-back",
      can_go_back: false,
      can_go_forward: true,
      load_generation: 3,
    });
    goBackBrowserWebviewMock.mockReturnValueOnce(slowBack.promise).mockResolvedValueOnce(Result.succeed(fastBackState));

    const clearSurfaceIssue = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createBrowserState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(true);

      const actions = useBrowserViewActions({
        browserUrl: "https://example.com/article",
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState: vi.fn(),
        clearSurfaceIssue,
        showToast: vi.fn(),
        syncBrowserWebview: vi.fn(async () => {}),
        initialBrowserState: createInitialBrowserState,
        fallbackInFlightRef,
      });

      return { ...actions, browserState, fallbackInFlightRef };
    });

    let firstBack: Promise<void> | null = null;
    await act(async () => {
      firstBack = result.current.handleGoBack();
      await result.current.handleGoBack();
    });

    expect(result.current.browserState).toEqual(fastBackState);
    expect(result.current.fallbackInFlightRef.current).toBe(false);

    await act(async () => {
      slowBack.resolve(Result.succeed(slowBackState));
      if (!firstBack) {
        throw new Error("Missing first back command promise");
      }
      await firstBack;
    });

    expect(result.current.browserState).toEqual(fastBackState);
    expect(clearSurfaceIssue).toHaveBeenCalledTimes(1);
  });

  it("keeps reload and open-external availability gated by the overlay browser URL", async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createBrowserState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      return useBrowserViewActions({
        browserUrl: null,
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState: vi.fn(),
        clearSurfaceIssue: vi.fn(),
        showToast,
        syncBrowserWebview: vi.fn(async () => {}),
        initialBrowserState: createInitialBrowserState,
        fallbackInFlightRef,
      });
    });

    await act(async () => {
      await result.current.handleReload();
      await result.current.handleOpenExternal();
    });

    expect(reloadBrowserWebviewMock).not.toHaveBeenCalled();
    expect(openUrlInExternalBrowserMock).not.toHaveBeenCalled();
  });

  it("opens the overlay browser URL externally in foreground mode", async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() => createBrowserState());
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      return useBrowserViewActions({
        browserUrl: "https://example.com/article",
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState: vi.fn(),
        clearSurfaceIssue: vi.fn(),
        showToast,
        syncBrowserWebview: vi.fn(async () => {}),
        initialBrowserState: createInitialBrowserState,
        fallbackInFlightRef,
      });
    });

    await act(async () => {
      await result.current.handleOpenExternal();
    });

    expect(openUrlInExternalBrowserMock).toHaveBeenCalledWith("https://example.com/article", {
      background: false,
      errorLabel: "Failed to open preview in external browser",
      showToast,
    });
  });

  it("opens the current preview URL after in-page navigation", async () => {
    const showToast = vi.fn();
    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(() =>
        createBrowserState({ url: "https://example.com/navigated" }),
      );
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(false);

      return useBrowserViewActions({
        browserUrl: "https://example.com/feed-article",
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState: vi.fn(),
        clearSurfaceIssue: vi.fn(),
        showToast,
        syncBrowserWebview: vi.fn(async () => {}),
        initialBrowserState: createInitialBrowserState,
        fallbackInFlightRef,
      });
    });

    await act(async () => {
      await result.current.handleOpenExternal();
    });

    expect(openUrlInExternalBrowserMock).toHaveBeenCalledWith("https://example.com/navigated", {
      background: false,
      errorLabel: "Failed to open preview in external browser",
      showToast,
    });
  });

  it("does not retry the embedded webview without a browser URL", () => {
    const resetBrowserWebviewSyncState = vi.fn();
    const clearSurfaceIssue = vi.fn();
    const syncBrowserWebview = vi.fn(async () => {});

    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(null);
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(true);

      const actions = useBrowserViewActions({
        browserUrl: null,
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState,
        clearSurfaceIssue,
        showToast: vi.fn(),
        syncBrowserWebview,
        initialBrowserState: createInitialBrowserState,
        fallbackInFlightRef,
      });

      return { ...actions, fallbackInFlightRef, browserState };
    });

    act(() => {
      result.current.handleRetry();
    });

    expect(result.current.fallbackInFlightRef.current).toBe(true);
    expect(result.current.browserState).toBeNull();
    expect(resetBrowserWebviewSyncState).not.toHaveBeenCalled();
    expect(clearSurfaceIssue).not.toHaveBeenCalled();
    expect(syncBrowserWebview).not.toHaveBeenCalled();
  });

  it("surfaces rejected retry sync failures from the native webview boundary", async () => {
    const error = new Error("retry rejected");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const resetBrowserWebviewSyncState = vi.fn();
    const clearSurfaceIssue = vi.fn();
    const showToast = vi.fn();
    const syncBrowserWebview = vi.fn(async () => {
      throw error;
    });
    useUiStore.getState().openBrowser("https://example.com/article");

    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(null);
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(true);

      const actions = useBrowserViewActions({
        browserUrl: "https://example.com/article",
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState,
        clearSurfaceIssue,
        showToast,
        syncBrowserWebview,
        initialBrowserState: createInitialBrowserState,
        fallbackInFlightRef,
      });

      return { ...actions, fallbackInFlightRef, browserState };
    });

    act(() => {
      result.current.handleRetry();
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.fallbackInFlightRef.current).toBe(false);
    expect(result.current.browserState).toEqual(createInitialBrowserState("https://example.com/article"));
    expect(resetBrowserWebviewSyncState).toHaveBeenCalledTimes(1);
    expect(clearSurfaceIssue).toHaveBeenCalledTimes(1);
    expect(syncBrowserWebview).toHaveBeenCalledWith("https://example.com/article", "create");
    expect(consoleError).toHaveBeenCalledWith("Failed to retry embedded browser webview:", error);
    expect(showToast).toHaveBeenCalledWith("retry rejected");
  });

  it("ignores late retry rejections after the overlay URL changes", async () => {
    const error = new Error("late retry rejected");
    const retrySync = deferred<void>();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const showToast = vi.fn();
    const syncBrowserWebview = vi.fn(() => retrySync.promise);
    useUiStore.getState().openBrowser("https://example.com/article");

    const { result } = renderHook(() => {
      const [browserState, setBrowserState] = useState<BrowserWebviewState | null>(null);
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;
      const fallbackInFlightRef = useRef(true);

      const actions = useBrowserViewActions({
        browserUrl: "https://example.com/article",
        browserStateRef,
        setBrowserState,
        resetBrowserWebviewSyncState: vi.fn(),
        clearSurfaceIssue: vi.fn(),
        showToast,
        syncBrowserWebview,
        initialBrowserState: createInitialBrowserState,
        fallbackInFlightRef,
      });

      return { ...actions, browserState };
    });

    act(() => {
      result.current.handleRetry();
      useUiStore.getState().openBrowser("https://example.com/next");
    });

    await act(async () => {
      retrySync.reject(error);
      await retrySync.promise.catch(() => undefined);
    });

    expect(result.current.browserState).toEqual(createInitialBrowserState("https://example.com/article"));
    expect(syncBrowserWebview).toHaveBeenCalledWith("https://example.com/article", "create");
    expect(consoleError).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});
