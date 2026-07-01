import type { RefObject } from "react";
import { useCallback, useLayoutEffect, useState } from "react";
import { toBrowserWebviewBounds } from "@/lib/browser/browser-webview";
import type { BrowserViewLayoutDiagnostics } from "../../browser-view.types";

type UseBrowserLayoutDiagnosticsParams = {
  browserUrl: string | null;
  showDiagnostics: boolean;
  overlayRef: RefObject<HTMLDivElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  hostRef: RefObject<HTMLDivElement | null>;
};

type UseBrowserLayoutDiagnosticsResult = {
  layoutDiagnostics: BrowserViewLayoutDiagnostics | null;
  captureLayoutDiagnostics: () => void;
};

export function useBrowserLayoutDiagnostics({
  browserUrl,
  showDiagnostics,
  overlayRef,
  stageRef,
  hostRef,
}: UseBrowserLayoutDiagnosticsParams): UseBrowserLayoutDiagnosticsResult {
  const [layoutDiagnostics, setLayoutDiagnostics] = useState<BrowserViewLayoutDiagnostics | null>(null);
  const [wasShowingDiagnostics, setWasShowingDiagnostics] = useState(showDiagnostics);

  // Adjust state during render when the prop changes instead of routing the reset
  // through an effect, which would force an extra render with a stale value.
  if (wasShowingDiagnostics !== showDiagnostics) {
    setWasShowingDiagnostics(showDiagnostics);
    if (!showDiagnostics) {
      setLayoutDiagnostics(null);
    }
  }

  const captureLayoutDiagnostics = useCallback(() => {
    if (!showDiagnostics) {
      return;
    }

    const overlayRect = overlayRef.current?.getBoundingClientRect();
    const stageRect = stageRef.current?.getBoundingClientRect();
    const hostRect = hostRef.current?.getBoundingClientRect();
    if (!overlayRef.current || !stageRef.current || !hostRef.current || !overlayRect || !stageRect || !hostRect) {
      return;
    }

    const overlayBounds = toBrowserWebviewBounds(overlayRect);
    const stageBounds = toBrowserWebviewBounds(stageRect);
    const hostBounds = toBrowserWebviewBounds(hostRect);
    if (!overlayBounds || !stageBounds || !hostBounds) {
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

  return {
    layoutDiagnostics,
    captureLayoutDiagnostics,
  };
}
