import { type RefObject, useCallback, useEffect, useLayoutEffect, useState } from "react";
import type { BrowserDebugGeometryLayoutDiagnostics } from "@/lib/browser-debug-geometry";
import { toBrowserWebviewBounds } from "@/lib/browser-webview";

type UseBrowserLayoutDiagnosticsParams = {
  browserUrl: string | null;
  showDiagnostics: boolean;
  overlayRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
};

export function useBrowserLayoutDiagnostics({
  browserUrl,
  showDiagnostics,
  overlayRef,
  stageRef,
  hostRef,
}: UseBrowserLayoutDiagnosticsParams) {
  const [layoutDiagnostics, setLayoutDiagnostics] = useState<BrowserDebugGeometryLayoutDiagnostics | null>(null);

  const captureLayoutDiagnostics = useCallback(() => {
    if (!showDiagnostics) {
      return;
    }

    const overlayRect = overlayRef.current?.getBoundingClientRect();
    const stageRect = stageRef.current?.getBoundingClientRect();
    const hostRect = hostRef.current?.getBoundingClientRect();
    const overlayBounds = overlayRect ? toBrowserWebviewBounds(overlayRect) : null;
    const stageBounds = stageRect ? toBrowserWebviewBounds(stageRect) : null;
    const hostBounds = hostRect ? toBrowserWebviewBounds(hostRect) : null;
    if (!overlayRect || !stageRect || !hostRect || !overlayBounds || !stageBounds || !hostBounds) {
      return;
    }

    setLayoutDiagnostics({
      viewport: {
        width: Math.round(window.innerWidth),
        height: Math.round(window.innerHeight),
      },
      overlay: overlayBounds,
      hostLogical: hostBounds,
      stage: stageBounds,
      lane: {
        left: Math.round(stageRect.left - overlayRect.left),
        top: Math.round(stageRect.top - overlayRect.top),
        right: Math.round(overlayRect.right - stageRect.right),
        bottom: Math.round(overlayRect.bottom - stageRect.bottom),
      },
    });
  }, [hostRef, overlayRef, showDiagnostics, stageRef]);

  useLayoutEffect(() => {
    if (!browserUrl || !showDiagnostics) {
      return;
    }

    captureLayoutDiagnostics();
  }, [browserUrl, captureLayoutDiagnostics, showDiagnostics]);

  useEffect(() => {
    if (showDiagnostics) {
      return;
    }

    setLayoutDiagnostics(null);
  }, [showDiagnostics]);

  return {
    layoutDiagnostics,
    captureLayoutDiagnostics,
  } as const;
}
