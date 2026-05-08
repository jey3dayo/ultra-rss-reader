import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBrowserWebviewEvents } from "@/components/reader/hooks/browser/use-browser-webview-events";
import { BROWSER_WINDOW_EVENTS } from "@/constants/browser";

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
});
