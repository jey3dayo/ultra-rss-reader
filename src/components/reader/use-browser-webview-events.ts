import { listen } from "@tauri-apps/api/event";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { BROWSER_WINDOW_EVENTS } from "@/constants/browser";
import type { BrowserDebugGeometryNativeDiagnostics } from "@/lib/browser-debug-geometry";
import type { BrowserWebviewFallbackPayload } from "./browser-webview-state";

type UseBrowserWebviewEventsParams = {
  showDiagnostics: boolean;
  onStateChanged: (payload: BrowserWebviewState) => void;
  onFallback: (payload: BrowserWebviewFallbackPayload) => void;
  onClosed: () => void;
  onDiagnostics: (payload: BrowserDebugGeometryNativeDiagnostics) => void;
};

export function useBrowserWebviewEvents({
  showDiagnostics,
  onStateChanged,
  onFallback,
  onClosed,
  onDiagnostics,
}: UseBrowserWebviewEventsParams): () => Promise<void> {
  const listenerReadyRef = useRef<Promise<void> | null>(null);
  const unlistenRef = useRef<Array<() => void>>([]);

  useLayoutEffect(() => {
    let cancelled = false;

    listenerReadyRef.current = Promise.all([
      listen<BrowserWebviewState>(BROWSER_WINDOW_EVENTS.stateChanged, ({ payload }) => {
        if (cancelled) return;
        onStateChanged(payload);
      }),
      listen<BrowserWebviewFallbackPayload>(BROWSER_WINDOW_EVENTS.fallback, ({ payload }) => {
        if (cancelled) return;
        onFallback(payload);
      }),
      listen(BROWSER_WINDOW_EVENTS.closed, () => {
        if (cancelled) return;
        onClosed();
      }),
      ...(showDiagnostics
        ? [
            listen<BrowserDebugGeometryNativeDiagnostics>(BROWSER_WINDOW_EVENTS.diagnostics, ({ payload }) => {
              if (cancelled) return;
              onDiagnostics(payload);
            }),
          ]
        : []),
    ]).then((cleanups) => {
      if (cancelled) {
        cleanups.forEach((cleanup) => {
          cleanup();
        });
        return;
      }
      unlistenRef.current = cleanups;
    });

    return () => {
      cancelled = true;
      unlistenRef.current.forEach((cleanup) => {
        cleanup();
      });
      unlistenRef.current = [];
      listenerReadyRef.current = null;
    };
  }, [onClosed, onDiagnostics, onFallback, onStateChanged, showDiagnostics]);

  return useCallback(() => listenerReadyRef.current ?? Promise.resolve(), []);
}
