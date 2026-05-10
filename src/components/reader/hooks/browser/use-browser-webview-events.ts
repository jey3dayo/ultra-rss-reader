import { listen } from "@tauri-apps/api/event";
import { useCallback, useLayoutEffect, useRef } from "react";
import {
  BrowserWebviewDiagnosticsPayloadSchema,
  BrowserWebviewFallbackPayloadSchema,
  BrowserWebviewStateSchema,
} from "@/api/schemas";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { BROWSER_WINDOW_EVENTS } from "@/constants/browser";
import type { BrowserDebugGeometryNativeDiagnostics } from "@/lib/browser/browser-debug-geometry";
import { createTauriListenerGroup } from "@/lib/runtime/tauri-event-listeners";
import { useUiStore } from "@/stores/ui-store";
import {
  type BrowserWebviewFallbackPayload,
  isBrowserWebviewFallbackForRequestedUrl,
} from "../../browser-webview-state";

type UseBrowserWebviewEventsParams = {
  showDiagnostics: boolean;
  onStateChanged: (payload: BrowserWebviewState) => void;
  onFallback: (payload: BrowserWebviewFallbackPayload) => void;
  onClosed: () => void;
  onDiagnostics: (payload: BrowserDebugGeometryNativeDiagnostics) => void;
};

type UseBrowserWebviewEventsResult = () => Promise<void>;

function parseBrowserWebviewStatePayload(payload: unknown): BrowserWebviewState | null {
  const result = BrowserWebviewStateSchema.safeParse(payload);
  return result.success ? result.data : null;
}

function parseBrowserWebviewFallbackPayload(payload: unknown): BrowserWebviewFallbackPayload | null {
  const result = BrowserWebviewFallbackPayloadSchema.safeParse(payload);
  return result.success ? result.data : null;
}

function parseBrowserWebviewDiagnosticsPayload(payload: unknown): BrowserDebugGeometryNativeDiagnostics | null {
  const result = BrowserWebviewDiagnosticsPayloadSchema.safeParse(payload);
  return result.success ? result.data : null;
}

function malformedPayloadSummary(payload: unknown) {
  if (Array.isArray(payload)) {
    return "array";
  }
  if (payload === null) {
    return "null";
  }
  return typeof payload;
}

function warnMalformedBrowserWebviewEvent(warnedMalformedEventNames: Set<string>, eventName: string, payload: unknown) {
  if (warnedMalformedEventNames.has(eventName)) {
    return;
  }

  warnedMalformedEventNames.add(eventName);
  console.warn(
    `Ignored malformed embedded browser webview ${eventName} payload: payloadType=${malformedPayloadSummary(payload)}`,
  );
}

export function useBrowserWebviewEvents({
  showDiagnostics,
  onStateChanged,
  onFallback,
  onClosed,
  onDiagnostics,
}: UseBrowserWebviewEventsParams): UseBrowserWebviewEventsResult {
  const listenerReadyRef = useRef<Promise<void> | null>(null);
  const warnedMalformedEventNamesRef = useRef<Set<string>>(new Set());

  useLayoutEffect(() => {
    let cancelled = false;
    warnedMalformedEventNamesRef.current.clear();
    const listenerGroup = createTauriListenerGroup([
      {
        owner: "browser-webview-events:state-changed",
        subscription: listen<unknown>(BROWSER_WINDOW_EVENTS.stateChanged, ({ payload }) => {
          if (cancelled) return;
          const nextState = parseBrowserWebviewStatePayload(payload);
          if (!nextState) {
            warnMalformedBrowserWebviewEvent(
              warnedMalformedEventNamesRef.current,
              BROWSER_WINDOW_EVENTS.stateChanged,
              payload,
            );
            return;
          }
          onStateChanged(nextState);
        }),
      },
      {
        owner: "browser-webview-events:fallback",
        subscription: listen<unknown>(BROWSER_WINDOW_EVENTS.fallback, ({ payload }) => {
          if (cancelled) return;
          const fallbackPayload = parseBrowserWebviewFallbackPayload(payload);
          if (!fallbackPayload) {
            warnMalformedBrowserWebviewEvent(
              warnedMalformedEventNamesRef.current,
              BROWSER_WINDOW_EVENTS.fallback,
              payload,
            );
            return;
          }
          const requestedUrl = useUiStore.getState().browserUrl;
          if (requestedUrl && !isBrowserWebviewFallbackForRequestedUrl(fallbackPayload, requestedUrl)) {
            return;
          }
          onFallback(fallbackPayload);
        }),
      },
      {
        owner: "browser-webview-events:closed",
        subscription: listen(BROWSER_WINDOW_EVENTS.closed, () => {
          if (cancelled) return;
          onClosed();
        }),
      },
      ...(showDiagnostics
        ? [
            {
              owner: "browser-webview-events:diagnostics",
              subscription: listen<unknown>(BROWSER_WINDOW_EVENTS.diagnostics, ({ payload }) => {
                if (cancelled) return;
                const diagnosticsPayload = parseBrowserWebviewDiagnosticsPayload(payload);
                if (!diagnosticsPayload) {
                  warnMalformedBrowserWebviewEvent(
                    warnedMalformedEventNamesRef.current,
                    BROWSER_WINDOW_EVENTS.diagnostics,
                    payload,
                  );
                  return;
                }
                onDiagnostics(diagnosticsPayload);
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
  }, [onClosed, onDiagnostics, onFallback, onStateChanged, showDiagnostics]);

  return useCallback(() => listenerReadyRef.current ?? Promise.resolve(), []);
}
