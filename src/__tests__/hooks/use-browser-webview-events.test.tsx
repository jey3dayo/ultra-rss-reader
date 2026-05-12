import { act, renderHook } from "@testing-library/react";
import { resetTauriRuntimeFlags, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { useBrowserWebviewEvents } from "@/components/reader/hooks/browser/use-browser-webview-events";
import { BROWSER_WINDOW_EVENTS } from "@/constants/browser";
import type { BrowserDebugGeometryNativeDiagnostics } from "@/lib/browser/browser-debug-geometry";
import type { BrowserWebviewFallbackPayload } from "@/lib/browser/browser-webview-state";
import { TAURI_EVENT_LISTENER_FAILURE_EVENT } from "@/lib/runtime/tauri-event-listeners";
import { useUiStore } from "@/stores/ui-store";

type EventCallback = (event: { payload: unknown }) => void;
type Cleanup = () => void;

const listenMock = vi.hoisted(() => vi.fn<(eventName: string, callback: EventCallback) => Promise<Cleanup>>());

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

describe("useBrowserWebviewEvents", () => {
  beforeEach(() => {
    listenMock.mockReset();
    useUiStore.setState(useUiStore.getInitialState());
  });

  afterEach(() => {
    resetTauriRuntimeFlags();
    vi.restoreAllMocks();
  });

  function getListener(eventName: string): EventCallback {
    const call = listenMock.mock.calls.find(([registeredEventName]) => registeredEventName === eventName);
    if (!call) {
      throw new Error(`Missing listener for ${eventName}`);
    }
    return call[1];
  }

  function warnOnceMalformedPayloadEvents() {
    const malformedEvents = [
      [BROWSER_WINDOW_EVENTS.stateChanged, null],
      [BROWSER_WINDOW_EVENTS.stateChanged, "still malformed"],
      [BROWSER_WINDOW_EVENTS.fallback, null],
      [BROWSER_WINDOW_EVENTS.fallback, ["still malformed"]],
      [BROWSER_WINDOW_EVENTS.diagnostics, null],
      [BROWSER_WINDOW_EVENTS.diagnostics, ["still malformed"]],
    ] as const;

    for (const [eventName, payload] of malformedEvents) {
      getListener(eventName)({ payload });
    }
  }

  it("cleans up browser webview listeners after unmount even when registration resolves late", async () => {
    const cleanups = [vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    const pendingResolves: ((cleanup: Cleanup) => void)[] = [];
    listenMock.mockImplementation(
      () =>
        new Promise<Cleanup>((resolve) => {
          pendingResolves.push(resolve);
        }),
    );

    const { result, unmount } = renderHook(() =>
      useBrowserWebviewEvents({
        showDiagnostics: true,
        onStateChanged: vi.fn(),
        onFallback: vi.fn(),
        onClosed: vi.fn(),
        onDiagnostics: vi.fn(),
      }),
    );
    const ready = result.current();

    unmount();

    await act(async () => {
      pendingResolves.forEach((resolve, index) => {
        const cleanup = cleanups[index];
        if (!cleanup) {
          throw new Error(`Missing cleanup for listener ${index}`);
        }
        resolve(cleanup);
      });
      await ready;
    });

    expect(listenMock.mock.calls.map(([eventName]) => eventName)).toEqual([
      BROWSER_WINDOW_EVENTS.stateChanged,
      BROWSER_WINDOW_EVENTS.fallback,
      BROWSER_WINDOW_EVENTS.closed,
      BROWSER_WINDOW_EVENTS.diagnostics,
    ]);
    expect(cleanups.every((cleanup) => cleanup.mock.calls.length === 1)).toBe(true);
  });

  it("ignores duplicate native events after cleanup fails on unmount", async () => {
    const cleanupError = new Error("cleanup failed");
    const onStateChanged = vi.fn();
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    listenMock.mockResolvedValue(() => {
      throw cleanupError;
    });

    const { result, unmount } = renderHook(() =>
      useBrowserWebviewEvents({
        showDiagnostics: false,
        onStateChanged,
        onFallback: vi.fn(),
        onClosed: vi.fn(),
        onDiagnostics: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current();
    });
    const stateChangedListener = getListener(BROWSER_WINDOW_EVENTS.stateChanged);

    unmount();
    stateChangedListener({
      payload: {
        url: "https://example.com/article",
        can_go_back: false,
        can_go_forward: false,
        is_loading: false,
      },
    });

    expect(onStateChanged).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("cleans up only the non-diagnostics listeners when diagnostics are hidden", async () => {
    const cleanups = [vi.fn(), vi.fn(), vi.fn()];
    listenMock.mockImplementation((_eventName, _callback) => {
      const cleanup = cleanups[listenMock.mock.calls.length - 1];
      if (!cleanup) {
        throw new Error("Missing cleanup for listener");
      }
      return Promise.resolve(cleanup);
    });

    const { result, unmount } = renderHook(() =>
      useBrowserWebviewEvents({
        showDiagnostics: false,
        onStateChanged: vi.fn(),
        onFallback: vi.fn(),
        onClosed: vi.fn(),
        onDiagnostics: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current();
    });
    unmount();

    expect(listenMock.mock.calls.map(([eventName]) => eventName)).toEqual([
      BROWSER_WINDOW_EVENTS.stateChanged,
      BROWSER_WINDOW_EVENTS.fallback,
      BROWSER_WINDOW_EVENTS.closed,
    ]);
    expect(cleanups.every((cleanup) => cleanup.mock.calls.length === 1)).toBe(true);
  });

  it("keeps browser overlay open and close transitions from leaking native event listeners", async () => {
    const activeListeners = new Set<string>();
    listenMock.mockImplementation((eventName) => {
      const listenerKey = `${eventName}:${listenMock.mock.calls.length}`;
      activeListeners.add(listenerKey);
      return Promise.resolve(() => {
        activeListeners.delete(listenerKey);
      });
    });

    const { result, rerender, unmount } = renderHook(
      ({ showDiagnostics }) =>
        useBrowserWebviewEvents({
          showDiagnostics,
          onStateChanged: vi.fn(),
          onFallback: vi.fn(),
          onClosed: vi.fn(),
          onDiagnostics: vi.fn(),
        }),
      { initialProps: { showDiagnostics: false } },
    );

    await act(async () => {
      await result.current();
    });
    expect(activeListeners.size).toBe(3);

    rerender({ showDiagnostics: true });
    await act(async () => {
      await result.current();
    });
    expect(activeListeners.size).toBe(4);

    rerender({ showDiagnostics: false });
    await act(async () => {
      await result.current();
    });
    expect(activeListeners.size).toBe(3);

    unmount();
    expect(activeListeners.size).toBe(0);
  });

  it("surfaces browser webview listener registration failures with the listener owner", async () => {
    setTauriRuntimePresent();
    const error = new Error("browser webview listener failed");
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onFailure = vi.fn();
    listenMock.mockRejectedValue(error);
    window.addEventListener(TAURI_EVENT_LISTENER_FAILURE_EVENT, onFailure);

    const { result } = renderHook(() =>
      useBrowserWebviewEvents({
        showDiagnostics: false,
        onStateChanged: vi.fn(),
        onFallback: vi.fn(),
        onClosed: vi.fn(),
        onDiagnostics: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current();
    });

    expect(consoleWarn).toHaveBeenCalledTimes(3);
    expect(onFailure).toHaveBeenCalledTimes(3);
    expect(onFailure).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        detail: { owner: "browser-webview-events:state-changed" },
      }),
    );
    expect(onFailure).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        detail: { owner: "browser-webview-events:fallback" },
      }),
    );
    expect(onFailure).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        detail: { owner: "browser-webview-events:closed" },
      }),
    );
    window.removeEventListener(TAURI_EVENT_LISTENER_FAILURE_EVENT, onFailure);
  });

  it("passes valid native payloads to the matching browser webview handlers", async () => {
    const browserState: BrowserWebviewState = {
      url: "https://example.com/article",
      can_go_back: true,
      can_go_forward: false,
      is_loading: false,
      load_generation: 1,
    };
    const fallbackPayload: BrowserWebviewFallbackPayload = {
      url: "https://example.com/fallback",
      opened_external: false,
      error_message: null,
    };
    const diagnosticsPayload: BrowserDebugGeometryNativeDiagnostics = {
      action: "resize",
      requestedLogical: { x: 1, y: 2, width: 300, height: 200 },
      appliedLogical: { x: 1, y: 2, width: 300, height: 200 },
      scaleFactor: 2,
      nativeWebviewBounds: null,
    };
    const onStateChanged = vi.fn();
    const onFallback = vi.fn();
    const onDiagnostics = vi.fn();

    listenMock.mockResolvedValue(vi.fn());

    const { result } = renderHook(() =>
      useBrowserWebviewEvents({
        showDiagnostics: true,
        onStateChanged,
        onFallback,
        onClosed: vi.fn(),
        onDiagnostics,
      }),
    );

    await act(async () => {
      await result.current();
    });

    getListener(BROWSER_WINDOW_EVENTS.stateChanged)({ payload: browserState });
    getListener(BROWSER_WINDOW_EVENTS.fallback)({ payload: fallbackPayload });
    getListener(BROWSER_WINDOW_EVENTS.diagnostics)({
      payload: diagnosticsPayload,
    });

    expect(onStateChanged).toHaveBeenCalledWith(browserState);
    expect(onFallback).toHaveBeenCalledWith(fallbackPayload);
    expect(onDiagnostics).toHaveBeenCalledWith(diagnosticsPayload);
  });

  it("accepts closed events only for the current browser URL and load generation", async () => {
    const onClosed = vi.fn();
    listenMock.mockResolvedValue(vi.fn());
    useUiStore.setState({ browserUrl: "https://example.com/current" });

    const { result } = renderHook(() =>
      useBrowserWebviewEvents({
        showDiagnostics: false,
        onStateChanged: vi.fn(),
        onFallback: vi.fn(),
        onClosed,
        onDiagnostics: vi.fn(),
        isClosedEventCurrent: (payload) =>
          payload.url === "https://example.com/current" && payload.load_generation === 2,
      }),
    );

    await act(async () => {
      await result.current();
    });

    const closedListener = getListener(BROWSER_WINDOW_EVENTS.closed);
    closedListener({
      payload: { url: "https://example.com/current", load_generation: 1 },
    });
    closedListener({
      payload: { url: "https://example.com/previous", load_generation: 2 },
    });
    closedListener({
      payload: { url: "https://example.com/current", load_generation: 2 },
    });

    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("accepts legacy closed events without payload as the current overlay", async () => {
    const onClosed = vi.fn();
    listenMock.mockResolvedValue(vi.fn());

    const { result } = renderHook(() =>
      useBrowserWebviewEvents({
        showDiagnostics: false,
        onStateChanged: vi.fn(),
        onFallback: vi.fn(),
        onClosed,
        onDiagnostics: vi.fn(),
        isClosedEventCurrent: () => false,
      }),
    );

    await act(async () => {
      await result.current();
    });

    getListener(BROWSER_WINDOW_EVENTS.closed)({ payload: undefined });

    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("ignores malformed native payloads before they reach browser webview handlers", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onStateChanged = vi.fn();
    const onFallback = vi.fn();
    const onDiagnostics = vi.fn();

    listenMock.mockResolvedValue(vi.fn());

    const { result } = renderHook(() =>
      useBrowserWebviewEvents({
        showDiagnostics: true,
        onStateChanged,
        onFallback,
        onClosed: vi.fn(),
        onDiagnostics,
      }),
    );

    await act(async () => {
      await result.current();
    });

    getListener(BROWSER_WINDOW_EVENTS.stateChanged)({
      payload: {
        url: "https://example.com/article",
        can_go_back: true,
        can_go_forward: false,
      },
    });
    getListener(BROWSER_WINDOW_EVENTS.fallback)({
      payload: {
        url: "https://example.com/fallback",
        opened_external: "false",
        error_message: null,
      },
    });
    getListener(BROWSER_WINDOW_EVENTS.diagnostics)({
      payload: {
        action: "resize",
        requestedLogical: { x: 1, y: 2, width: 300, height: 200 },
        appliedLogical: { x: 1, y: 2, width: 300, height: 200 },
        scaleFactor: "2",
        nativeWebviewBounds: null,
      },
    });

    expect(onStateChanged).not.toHaveBeenCalled();
    expect(onFallback).not.toHaveBeenCalled();
    expect(onDiagnostics).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledTimes(3);
  });

  it("ignores wrong native event payload shapes", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onStateChanged = vi.fn();
    const onFallback = vi.fn();
    const onDiagnostics = vi.fn();

    listenMock.mockResolvedValue(vi.fn());

    const { result } = renderHook(() =>
      useBrowserWebviewEvents({
        showDiagnostics: true,
        onStateChanged,
        onFallback,
        onClosed: vi.fn(),
        onDiagnostics,
      }),
    );

    await act(async () => {
      await result.current();
    });

    getListener(BROWSER_WINDOW_EVENTS.stateChanged)({
      payload: "https://example.com/article",
    });
    getListener(BROWSER_WINDOW_EVENTS.fallback)({ payload: null });
    getListener(BROWSER_WINDOW_EVENTS.diagnostics)({ payload: ["resize"] });

    expect(onStateChanged).not.toHaveBeenCalled();
    expect(onFallback).not.toHaveBeenCalled();
    expect(onDiagnostics).not.toHaveBeenCalled();
    expect(consoleWarn).toHaveBeenCalledTimes(3);
  });

  it("warns once per malformed native event payload shape to keep diagnostics specific without floods", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    listenMock.mockResolvedValue(vi.fn());

    const { result } = renderHook(() =>
      useBrowserWebviewEvents({
        showDiagnostics: true,
        onStateChanged: vi.fn(),
        onFallback: vi.fn(),
        onClosed: vi.fn(),
        onDiagnostics: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current();
    });

    warnOnceMalformedPayloadEvents();

    const malformedPayloadMessages = consoleWarn.mock.calls.reduce<string[]>((messages, [message]) => {
      if (typeof message === "string" && message.includes("Ignored malformed embedded browser webview")) {
        messages.push(message);
      }
      return messages;
    }, []);

    expect(malformedPayloadMessages).toEqual([
      `Ignored malformed embedded browser webview ${BROWSER_WINDOW_EVENTS.stateChanged} payload: payloadType=null; issues=invalid_type:<root>`,
      `Ignored malformed embedded browser webview ${BROWSER_WINDOW_EVENTS.stateChanged} payload: payloadType=string; issues=invalid_type:<root>`,
      `Ignored malformed embedded browser webview ${BROWSER_WINDOW_EVENTS.fallback} payload: payloadType=null; issues=invalid_type:<root>`,
      `Ignored malformed embedded browser webview ${BROWSER_WINDOW_EVENTS.fallback} payload: payloadType=array; issues=invalid_type:<root>`,
      `Ignored malformed embedded browser webview ${BROWSER_WINDOW_EVENTS.diagnostics} payload: payloadType=null; issues=invalid_type:<root>`,
      `Ignored malformed embedded browser webview ${BROWSER_WINDOW_EVENTS.diagnostics} payload: payloadType=array; issues=invalid_type:<root>`,
    ]);
  });

  it("does not dump malformed native event payload values to console", async () => {
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => {});
    listenMock.mockResolvedValue(vi.fn());

    const { result } = renderHook(() =>
      useBrowserWebviewEvents({
        showDiagnostics: false,
        onStateChanged: vi.fn(),
        onFallback: vi.fn(),
        onClosed: vi.fn(),
        onDiagnostics: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current();
    });

    getListener(BROWSER_WINDOW_EVENTS.stateChanged)({
      payload: {
        url: "https://example.com/article?token=private#section",
      },
    });

    expect(consoleWarn).toHaveBeenCalledTimes(1);
    const serializedWarnArgs = JSON.stringify(consoleWarn.mock.calls);
    expect(serializedWarnArgs).toContain("payloadType=object");
    expect(serializedWarnArgs).not.toContain("https://example.com");
    expect(serializedWarnArgs).not.toContain("token=private");
    expect(serializedWarnArgs).not.toContain("#section");
  });
});
