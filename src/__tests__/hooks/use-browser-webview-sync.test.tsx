import { Result } from "@praha/byethrow";
import { act, renderHook } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { useBrowserWebviewBoundsSync } from "@/components/reader/hooks/browser/use-browser-webview-bounds-sync";
import { useBrowserWebviewSync } from "@/components/reader/hooks/browser/use-browser-webview-sync";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

const {
  createOrUpdateBrowserWebviewMock,
  focusBrowserWebviewMock,
  setBrowserWebviewBoundsMock,
} = vi.hoisted(() => ({
  createOrUpdateBrowserWebviewMock: vi.fn(),
  focusBrowserWebviewMock: vi.fn(),
  setBrowserWebviewBoundsMock: vi.fn(),
}));

vi.mock("@/api/tauri-commands", () => ({
  createOrUpdateBrowserWebview: createOrUpdateBrowserWebviewMock,
  focusBrowserWebview: focusBrowserWebviewMock,
  setBrowserWebviewBounds: setBrowserWebviewBoundsMock,
}));

const browserUrl = "https://example.com/article";

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
}

function createBrowserState(
  overrides?: Partial<BrowserWebviewState>,
): BrowserWebviewState {
  return {
    url: browserUrl,
    can_go_back: false,
    can_go_forward: false,
    is_loading: false,
    ...overrides,
  };
}

function createDomRect({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    x,
    y,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function createHostElement(
  initialRect = createDomRect({ x: 12, y: 34, width: 600, height: 400 }),
) {
  const element = document.createElement("div");
  const getBoundingClientRect = vi
    .spyOn(element, "getBoundingClientRect")
    .mockReturnValue(initialRect);
  return { element, getBoundingClientRect };
}

function renderBrowserWebviewSync(hostElement: HTMLDivElement) {
  return renderHook(() => {
    const hostRef = useRef<HTMLDivElement | null>(hostElement);
    const [browserState, setBrowserState] =
      useState<BrowserWebviewState | null>(null);
    const browserStateRef = useRef(browserState);
    browserStateRef.current = browserState;

    return useBrowserWebviewSync({
      hostRef,
      platformKind: "windows",
      browserStateRef,
      captureLayoutDiagnostics: vi.fn(),
      setBrowserState,
      onMissingEmbeddedBrowserWebview: vi.fn(),
      showSurfaceFailure: vi.fn(),
    });
  });
}

describe("useBrowserWebviewSync", () => {
  beforeEach(() => {
    createOrUpdateBrowserWebviewMock.mockReset();
    focusBrowserWebviewMock.mockReset();
    setBrowserWebviewBoundsMock.mockReset();
    createOrUpdateBrowserWebviewMock.mockResolvedValue(
      Result.succeed(createBrowserState({ is_loading: true })),
    );
    focusBrowserWebviewMock.mockResolvedValue(Result.succeed(null));
    setBrowserWebviewBoundsMock.mockResolvedValue(Result.succeed(null));
    usePreferencesStore.setState({ prefs: {}, loaded: true });
    useUiStore.setState({ ...useUiStore.getInitialState(), browserUrl });
  });

  it("focuses the webview after creating it even when focus retention is disabled", async () => {
    const { element } = createHostElement();
    const { result } = renderBrowserWebviewSync(element);

    await act(async () => {
      await result.current.syncBrowserWebview(browserUrl, "create");
    });

    expect(createOrUpdateBrowserWebviewMock).toHaveBeenCalledTimes(1);
    expect(focusBrowserWebviewMock).toHaveBeenCalledTimes(1);
  });

  it("focuses the webview after creating it when focus retention is not configured", async () => {
    const { element } = createHostElement();
    const { result } = renderBrowserWebviewSync(element);

    await act(async () => {
      await result.current.syncBrowserWebview(browserUrl, "create");
    });

    expect(createOrUpdateBrowserWebviewMock).toHaveBeenCalledTimes(1);
    expect(focusBrowserWebviewMock).toHaveBeenCalledTimes(1);
  });

  it("queues resize bounds while create is in flight and flushes only the latest bounds after create succeeds", async () => {
    const createDeferredResult =
      createDeferred<ReturnType<typeof Result.succeed<BrowserWebviewState>>>();
    createOrUpdateBrowserWebviewMock.mockReturnValue(
      createDeferredResult.promise,
    );
    const { element, getBoundingClientRect } = createHostElement();
    const { result } = renderBrowserWebviewSync(element);

    await act(async () => {
      void result.current.syncBrowserWebview(browserUrl, "create");
    });

    getBoundingClientRect.mockReturnValue(
      createDomRect({ x: 20, y: 40, width: 640, height: 420 }),
    );
    await act(async () => {
      await result.current.syncBrowserWebview(browserUrl, "resize");
    });

    getBoundingClientRect.mockReturnValue(
      createDomRect({ x: 30, y: 50, width: 700, height: 460 }),
    );
    await act(async () => {
      await result.current.syncBrowserWebview(browserUrl, "resize");
    });

    expect(setBrowserWebviewBoundsMock).not.toHaveBeenCalled();

    await act(async () => {
      createDeferredResult.resolve(
        Result.succeed(createBrowserState({ is_loading: true })),
      );
      await createDeferredResult.promise;
    });

    expect(createOrUpdateBrowserWebviewMock).toHaveBeenCalledTimes(1);
    expect(setBrowserWebviewBoundsMock).toHaveBeenCalledTimes(1);
    expect(setBrowserWebviewBoundsMock).toHaveBeenCalledWith({
      x: 30,
      y: 50,
      width: 700,
      height: 460,
      unit: "physical",
    });
  });

  it("queues ResizeObserver bounds while create is in flight and flushes only the latest bounds after create succeeds", async () => {
    let resizeObserverCallback: ResizeObserverCallback | null = null;
    class TestResizeObserver {
      observe = vi.fn();
      disconnect = vi.fn();

      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallback = callback;
      }
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);

    const createDeferredResult =
      createDeferred<ReturnType<typeof Result.succeed<BrowserWebviewState>>>();
    createOrUpdateBrowserWebviewMock.mockReturnValue(
      createDeferredResult.promise,
    );
    const { element, getBoundingClientRect } = createHostElement();

    renderHook(() => {
      const hostRef = useRef<HTMLDivElement | null>(element);
      const [browserState, setBrowserState] =
        useState<BrowserWebviewState | null>(null);
      const browserStateRef = useRef(browserState);
      browserStateRef.current = browserState;

      const webviewSync = useBrowserWebviewSync({
        hostRef,
        platformKind: "windows",
        browserStateRef,
        captureLayoutDiagnostics: vi.fn(),
        setBrowserState,
        onMissingEmbeddedBrowserWebview: vi.fn(),
        showSurfaceFailure: vi.fn(),
      });

      useBrowserWebviewBoundsSync({
        browserUrl,
        hostRef,
        waitForBrowserWebviewListeners: async () => {},
        syncBrowserWebview: webviewSync.syncBrowserWebview,
      });

      return webviewSync;
    });

    await vi.waitFor(() => {
      expect(createOrUpdateBrowserWebviewMock).toHaveBeenCalledTimes(1);
    });

    getBoundingClientRect.mockReturnValue(
      createDomRect({ x: 20, y: 40, width: 640, height: 420 }),
    );
    await act(async () => {
      resizeObserverCallback?.([], {} as ResizeObserver);
    });

    getBoundingClientRect.mockReturnValue(
      createDomRect({ x: 30, y: 50, width: 700, height: 460 }),
    );
    await act(async () => {
      resizeObserverCallback?.([], {} as ResizeObserver);
    });

    expect(setBrowserWebviewBoundsMock).not.toHaveBeenCalled();

    await act(async () => {
      createDeferredResult.resolve(
        Result.succeed(createBrowserState({ is_loading: true })),
      );
      await createDeferredResult.promise;
    });

    expect(setBrowserWebviewBoundsMock).toHaveBeenCalledTimes(1);
    expect(setBrowserWebviewBoundsMock).toHaveBeenCalledWith({
      x: 30,
      y: 50,
      width: 700,
      height: 460,
      unit: "physical",
    });
  });
});
