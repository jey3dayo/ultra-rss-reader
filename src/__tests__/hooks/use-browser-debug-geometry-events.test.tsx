import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBrowserDebugGeometryEvents } from "@/components/reader/hooks/browser/use-browser-debug-geometry-events";
import { APP_EVENTS } from "@/constants/events";
import type { BrowserDebugGeometrySnapshot } from "@/lib/browser/browser-debug-geometry";

describe("useBrowserDebugGeometryEvents", () => {
  it("publishes a null reset when diagnostics are initially disabled", () => {
    const details: (BrowserDebugGeometrySnapshot | null)[] = [];
    const listener = (event: Event) => {
      details.push((event as CustomEvent<BrowserDebugGeometrySnapshot | null>).detail);
    };
    window.addEventListener(APP_EVENTS.browserDebugGeometry, listener);

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
      window.removeEventListener(APP_EVENTS.browserDebugGeometry, listener);
    }
  });

  it("publishes a null reset when diagnostics turn off and when the enabled hook unmounts", () => {
    const details: (BrowserDebugGeometrySnapshot | null)[] = [];
    const listener = (event: Event) => {
      details.push((event as CustomEvent<BrowserDebugGeometrySnapshot | null>).detail);
    };
    window.addEventListener(APP_EVENTS.browserDebugGeometry, listener);

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
      window.removeEventListener(APP_EVENTS.browserDebugGeometry, listener);
    }
  });
});
