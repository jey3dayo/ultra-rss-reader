import { listen } from "@tauri-apps/api/event";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { BROWSER_WINDOW_EVENTS } from "@/constants/browser";
import type { BrowserDebugGeometryNativeDiagnostics } from "@/lib/browser-debug-geometry";
import { createTauriListenerGroup } from "@/lib/tauri-event-listeners";
import type { UseBrowserWebviewEventsParams, UseBrowserWebviewEventsResult } from "./browser-view.types";
import type { BrowserWebviewFallbackPayload } from "./browser-webview-state";

export function useBrowserWebviewEvents({
  showDiagnostics,
  onStateChanged,
  onFallback,
  onClosed,
  onDiagnostics,
}: UseBrowserWebviewEventsParams): UseBrowserWebviewEventsResult {
  const listenerReadyRef = useRef<Promise<void> | null>(null);

  useLayoutEffect(() => {
    let cancelled = false;
    const listenerGroup = createTauriListenerGroup([
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
    ]);
    listenerReadyRef.current = listenerGroup.ready;

    return () => {
      cancelled = true;
      listenerGroup.dispose();
      listenerReadyRef.current = null;
    };
  }, [onClosed, onDiagnostics, onFallback, onStateChanged, showDiagnostics]);

  return useCallback(() => listenerReadyRef.current ?? Promise.resolve(), []);
}
