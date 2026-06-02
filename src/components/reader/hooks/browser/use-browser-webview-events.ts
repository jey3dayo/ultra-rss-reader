import { Result } from "@praha/byethrow";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { BROWSER_WINDOW_EVENTS } from "@/constants/browser";
import type { BrowserDebugGeometryNativeDiagnostics } from "@/lib/browser/browser-debug-geometry";
import {
  type BrowserWebviewClosedPayload,
  parseBrowserWebviewClosedPayload,
  parseBrowserWebviewDiagnosticsPayload,
  parseBrowserWebviewFallbackPayload,
  parseBrowserWebviewStatePayload,
  warnMalformedBrowserWebviewEvent,
} from "@/lib/browser/browser-webview-event-payloads";
import {
  type BrowserWebviewFallbackPayload,
  isBrowserWebviewFallbackForRequestedUrl,
} from "@/lib/browser/browser-webview-state";
import { createTauriListenerGroup, listenTauriEvent } from "@/lib/runtime/tauri-event-listeners";
import { useUiStore } from "@/stores/ui-store";

type UseBrowserWebviewEventsParams = {
  showDiagnostics: boolean;
  onStateChanged: (payload: BrowserWebviewState) => void;
  onFallback: (payload: BrowserWebviewFallbackPayload) => void;
  onClosed: () => void;
  isClosedEventCurrent?: (payload: BrowserWebviewClosedPayload) => boolean;
  onDiagnostics: (payload: BrowserDebugGeometryNativeDiagnostics) => void;
};

type UseBrowserWebviewEventsResult = () => Promise<void>;

export function useBrowserWebviewEvents({
  showDiagnostics,
  onStateChanged,
  onFallback,
  onClosed,
  isClosedEventCurrent = () => true,
  onDiagnostics,
}: UseBrowserWebviewEventsParams): UseBrowserWebviewEventsResult {
  const listenerReadyRef = useRef<Promise<void> | null>(null);
  const warnedMalformedPayloadShapesRef = useRef<Set<string>>(new Set());

  useLayoutEffect(() => {
    let cancelled = false;
    warnedMalformedPayloadShapesRef.current.clear();
    const listenerGroup = createTauriListenerGroup([
      {
        owner: "browser-webview-events:state-changed",
        subscription: listenTauriEvent<unknown>(BROWSER_WINDOW_EVENTS.stateChanged, ({ payload }) => {
          if (cancelled) return;
          const result = parseBrowserWebviewStatePayload(payload);
          if (Result.isFailure(result)) {
            warnMalformedBrowserWebviewEvent(
              warnedMalformedPayloadShapesRef.current,
              BROWSER_WINDOW_EVENTS.stateChanged,
              payload,
              Result.unwrapError(result),
            );
            return;
          }
          onStateChanged(Result.unwrap(result));
        }),
      },
      {
        owner: "browser-webview-events:fallback",
        subscription: listenTauriEvent<unknown>(BROWSER_WINDOW_EVENTS.fallback, ({ payload }) => {
          if (cancelled) return;
          const result = parseBrowserWebviewFallbackPayload(payload);
          if (Result.isFailure(result)) {
            warnMalformedBrowserWebviewEvent(
              warnedMalformedPayloadShapesRef.current,
              BROWSER_WINDOW_EVENTS.fallback,
              payload,
              Result.unwrapError(result),
            );
            return;
          }
          const fallbackPayload = Result.unwrap(result);
          const requestedUrl = useUiStore.getState().browserUrl;
          if (requestedUrl && !isBrowserWebviewFallbackForRequestedUrl(fallbackPayload, requestedUrl)) {
            return;
          }
          onFallback(fallbackPayload);
        }),
      },
      {
        owner: "browser-webview-events:closed",
        subscription: listenTauriEvent<unknown>(BROWSER_WINDOW_EVENTS.closed, ({ payload }) => {
          if (cancelled) return;
          const result = parseBrowserWebviewClosedPayload(payload);
          if (Result.isFailure(result)) {
            warnMalformedBrowserWebviewEvent(
              warnedMalformedPayloadShapesRef.current,
              BROWSER_WINDOW_EVENTS.closed,
              payload,
              Result.unwrapError(result),
            );
            return;
          }
          const closedPayload = Result.unwrap(result);
          if (closedPayload !== null && !isClosedEventCurrent(closedPayload)) {
            return;
          }
          onClosed();
        }),
      },
      ...(showDiagnostics
        ? [
            {
              owner: "browser-webview-events:diagnostics",
              subscription: listenTauriEvent<unknown>(BROWSER_WINDOW_EVENTS.diagnostics, ({ payload }) => {
                if (cancelled) return;
                const result = parseBrowserWebviewDiagnosticsPayload(payload);
                if (Result.isFailure(result)) {
                  warnMalformedBrowserWebviewEvent(
                    warnedMalformedPayloadShapesRef.current,
                    BROWSER_WINDOW_EVENTS.diagnostics,
                    payload,
                    Result.unwrapError(result),
                  );
                  return;
                }
                onDiagnostics(Result.unwrap(result));
              }),
            },
          ]
        : []),
    ]);
    listenerReadyRef.current = listenerGroup.ready;

    return () => {
      cancelled = true;
      listenerGroup.dispose();
      listenerReadyRef.current = null;
    };
  }, [isClosedEventCurrent, onClosed, onDiagnostics, onFallback, onStateChanged, showDiagnostics]);

  return useCallback(() => listenerReadyRef.current ?? Promise.resolve(), []);
}
