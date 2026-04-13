import { useEffect } from "react";
import { APP_EVENTS } from "@/constants/events";
import type { UseBrowserDebugGeometryEventsParams } from "./browser-view.types";

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
