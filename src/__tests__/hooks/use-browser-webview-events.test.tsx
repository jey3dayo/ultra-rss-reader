import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import type { BrowserWebviewFallbackPayload } from "@/components/reader/browser-webview-state";
import { useBrowserWebviewEvents } from "@/components/reader/hooks/browser/use-browser-webview-events";
import { BROWSER_WINDOW_EVENTS } from "@/constants/browser";
import type { BrowserDebugGeometryNativeDiagnostics } from "@/lib/browser/browser-debug-geometry";

type EventCallback = (event: { payload: unknown }) => void;
type Cleanup = () => void;

const listenMock = vi.hoisted(() => vi.fn<(eventName: string, callback: EventCallback) => Promise<Cleanup>>());

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

describe("useBrowserWebviewEvents", () => {
  beforeEach(() => {
    listenMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function getListener(eventName: string): EventCallback {
    const call = listenMock.mock.calls.find(([registeredEventName]) => registeredEventName === eventName);
    if (!call) {
      throw new Error(`Missing listener for ${eventName}`);
    }
    return call[1];
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

  it("passes valid native payloads to the matching browser webview handlers", async () => {
    const browserState: BrowserWebviewState = {
      url: "https://example.com/article",
      can_go_back: true,
      can_go_forward: false,
      is_loading: false,
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
});
