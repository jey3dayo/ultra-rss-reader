import { cleanup, renderHook } from "@testing-library/react";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBrowserDebugGeometryEvents } from "@/components/reader/hooks/browser/use-browser-debug-geometry-events";
import { APP_EVENTS } from "@/constants/events";
import type { BrowserDebugGeometrySnapshot } from "@/lib/browser/browser-debug-geometry";

setupBrowserTestDom();

type BrowserDebugGeometryDetail = BrowserDebugGeometrySnapshot | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBrowserDebugGeometrySnapshot(value: unknown): value is BrowserDebugGeometrySnapshot {
  return isRecord(value) && "layoutDiagnostics" in value && "nativeDiagnostics" in value;
}

function readBrowserDebugGeometryDetail(event: Event): BrowserDebugGeometryDetail {
  if (!(event instanceof CustomEvent)) {
    throw new TypeError("Expected browser debug geometry event to be a CustomEvent");
  }

  if (event.detail === null || isBrowserDebugGeometrySnapshot(event.detail)) {
    return event.detail;
  }

  throw new TypeError("Expected browser debug geometry event detail to be null or a geometry snapshot");
}

function listenToBrowserDebugGeometry(listener: (detail: BrowserDebugGeometryDetail) => void): () => void {
  const eventListener = (event: Event) => {
    listener(readBrowserDebugGeometryDetail(event));
  };

  window.addEventListener(APP_EVENTS.browserDebugGeometry, eventListener);

  return () => {
    window.removeEventListener(APP_EVENTS.browserDebugGeometry, eventListener);
  };
}

describe("useBrowserDebugGeometryEvents", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("publishes a null reset when diagnostics are initially disabled", () => {
    const details: BrowserDebugGeometryDetail[] = [];
    const stopListening = listenToBrowserDebugGeometry((detail) => {
      details.push(detail);
    });

    try {
      renderHook(() =>
        useBrowserDebugGeometryEvents({
          showDiagnostics: false,
          layoutDiagnostics: null,
          nativeDiagnostics: null,
        }),
      );

      expect(details).toEqual([null]);
    } finally {
      stopListening();
    }
  });

  it("publishes a null reset when diagnostics turn off and when the enabled hook unmounts", () => {
    const details: BrowserDebugGeometryDetail[] = [];
    const stopListening = listenToBrowserDebugGeometry((detail) => {
      details.push(detail);
    });

    try {
      const { rerender, unmount } = renderHook(
        ({ showDiagnostics }) =>
          useBrowserDebugGeometryEvents({
            showDiagnostics,
            layoutDiagnostics: null,
            nativeDiagnostics: null,
          }),
        { initialProps: { showDiagnostics: true } },
      );

      rerender({ showDiagnostics: false });
      unmount();

      expect(details).toEqual([
        {
          layoutDiagnostics: null,
          nativeDiagnostics: null,
        },
        null,
        null,
      ]);
    } finally {
      stopListening();
    }
  });

  it("does not publish debug geometry events outside dev builds", () => {
    vi.stubEnv("DEV", false);
    const details: BrowserDebugGeometryDetail[] = [];
    const stopListening = listenToBrowserDebugGeometry((detail) => {
      details.push(detail);
    });

    try {
      const { unmount } = renderHook(() =>
        useBrowserDebugGeometryEvents({
          showDiagnostics: true,
          layoutDiagnostics: null,
          nativeDiagnostics: null,
        }),
      );

      unmount();

      expect(details).toEqual([]);
    } finally {
      stopListening();
    }
  });

  it("does not throw when the window event boundary is unavailable", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dispatchEvent = vi.spyOn(window, "dispatchEvent").mockImplementation(() => {
      throw new Error("dispatch unavailable");
    });

    expect(() =>
      renderHook(() =>
        useBrowserDebugGeometryEvents({
          showDiagnostics: false,
          layoutDiagnostics: null,
          nativeDiagnostics: null,
        }),
      ),
    ).not.toThrow();

    expect(warn).toHaveBeenCalledWith("Failed to dispatch browser debug geometry event.", expect.any(Error));
    dispatchEvent.mockRestore();
  });
});
