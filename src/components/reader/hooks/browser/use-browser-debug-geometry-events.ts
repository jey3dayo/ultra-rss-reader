import { useEffect } from "react";
import { APP_EVENTS } from "@/constants/events";
import { createBrowserDebugGeometrySnapshot } from "@/lib/browser/browser-debug-geometry";
import type { BrowserViewLayoutDiagnostics, BrowserWebviewDiagnosticsPayload } from "../../browser-view.types";

type UseBrowserDebugGeometryEventsParams = {
  showDiagnostics: boolean;
  layoutDiagnostics: BrowserViewLayoutDiagnostics | null;
  nativeDiagnostics: BrowserWebviewDiagnosticsPayload | null;
};

function dispatchBrowserDebugGeometryEvent(detail: ReturnType<typeof createBrowserDebugGeometrySnapshot> | null) {
  try {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.browserDebugGeometry, { detail }));
  } catch (error) {
    console.warn("Failed to dispatch browser debug geometry event.", error);
  }
}

export function useBrowserDebugGeometryEvents({
  showDiagnostics,
  layoutDiagnostics,
  nativeDiagnostics,
}: UseBrowserDebugGeometryEventsParams) {
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") {
      return undefined;
    }

    if (!showDiagnostics) {
      if (import.meta.env.DEV) {
        dispatchBrowserDebugGeometryEvent(null);
      }
      return;
    }

    if (!import.meta.env.DEV) {
      return undefined;
    }

    dispatchBrowserDebugGeometryEvent(
      createBrowserDebugGeometrySnapshot({
        layoutDiagnostics,
        nativeDiagnostics,
      }),
    );

    return () => {
      dispatchBrowserDebugGeometryEvent(null);
    };
  }, [layoutDiagnostics, nativeDiagnostics, showDiagnostics]);
}
