import { useEffect } from "react";
import { APP_EVENTS } from "@/constants/events";
import type {
  BrowserDebugGeometryLayoutDiagnostics,
  BrowserDebugGeometryNativeDiagnostics,
} from "@/lib/browser-debug-geometry";

type UseBrowserDebugGeometryEventsParams = {
  showDiagnostics: boolean;
  layoutDiagnostics: BrowserDebugGeometryLayoutDiagnostics | null;
  nativeDiagnostics: BrowserDebugGeometryNativeDiagnostics | null;
};

export function useBrowserDebugGeometryEvents({
  showDiagnostics,
  layoutDiagnostics,
  nativeDiagnostics,
}: UseBrowserDebugGeometryEventsParams) {
  useEffect(() => {
    if (!showDiagnostics) {
      window.dispatchEvent(new CustomEvent(APP_EVENTS.browserDebugGeometry, { detail: null }));
      return;
    }

    window.dispatchEvent(
      new CustomEvent(APP_EVENTS.browserDebugGeometry, {
        detail: {
          layoutDiagnostics,
          nativeDiagnostics,
        },
      }),
    );

    return () => {
      window.dispatchEvent(new CustomEvent(APP_EVENTS.browserDebugGeometry, { detail: null }));
    };
  }, [layoutDiagnostics, nativeDiagnostics, showDiagnostics]);
}
