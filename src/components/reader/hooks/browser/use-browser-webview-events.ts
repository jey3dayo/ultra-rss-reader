import { listen } from "@tauri-apps/api/event";
import { useCallback, useLayoutEffect, useRef } from "react";
import { BrowserWebviewStateSchema } from "@/api/schemas";
import type { BrowserWebviewState } from "@/api/tauri-commands";
import { BROWSER_WINDOW_EVENTS } from "@/constants/browser";
import type {
  BrowserDebugGeometryNativeDiagnostics,
  BrowserDebugGeometryRect,
} from "@/lib/browser/browser-debug-geometry";
import { createTauriListenerGroup } from "@/lib/runtime/tauri-event-listeners";
import type { BrowserWebviewFallbackPayload } from "../../browser-webview-state";

type UseBrowserWebviewEventsParams = {
  showDiagnostics: boolean;
  onStateChanged: (payload: BrowserWebviewState) => void;
  onFallback: (payload: BrowserWebviewFallbackPayload) => void;
  onClosed: () => void;
  onDiagnostics: (payload: BrowserDebugGeometryNativeDiagnostics) => void;
};

type UseBrowserWebviewEventsResult = () => Promise<void>;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isBrowserWebviewFallbackPayload(payload: unknown): payload is BrowserWebviewFallbackPayload {
  return (
    isObjectRecord(payload) &&
    typeof payload.url === "string" &&
    typeof payload.opened_external === "boolean" &&
    (payload.error_message === null || typeof payload.error_message === "string")
  );
}

function isBrowserDebugGeometryRect(payload: unknown): payload is BrowserDebugGeometryRect {
  return (
    isObjectRecord(payload) &&
    Number.isFinite(payload.x) &&
    Number.isFinite(payload.y) &&
    Number.isFinite(payload.width) &&
    Number.isFinite(payload.height)
  );
}

function isBrowserDebugGeometryNativeDiagnostics(payload: unknown): payload is BrowserDebugGeometryNativeDiagnostics {
  return (
    isObjectRecord(payload) &&
    typeof payload.action === "string" &&
    isBrowserDebugGeometryRect(payload.requestedLogical) &&
    isBrowserDebugGeometryRect(payload.appliedLogical) &&
    Number.isFinite(payload.scaleFactor) &&
    (payload.nativeWebviewBounds === null || isBrowserDebugGeometryRect(payload.nativeWebviewBounds))
  );
}

function parseBrowserWebviewStatePayload(payload: unknown): BrowserWebviewState | null {
  const result = BrowserWebviewStateSchema.safeParse(payload);
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
      listen<unknown>(BROWSER_WINDOW_EVENTS.stateChanged, ({ payload }) => {
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
      listen<unknown>(BROWSER_WINDOW_EVENTS.fallback, ({ payload }) => {
        if (cancelled) return;
        if (!isBrowserWebviewFallbackPayload(payload)) {
          warnMalformedBrowserWebviewEvent(
            warnedMalformedEventNamesRef.current,
            BROWSER_WINDOW_EVENTS.fallback,
            payload,
          );
          return;
        }
        onFallback(payload);
      }),
      listen(BROWSER_WINDOW_EVENTS.closed, () => {
        if (cancelled) return;
        onClosed();
      }),
      ...(showDiagnostics
        ? [
            listen<unknown>(BROWSER_WINDOW_EVENTS.diagnostics, ({ payload }) => {
              if (cancelled) return;
              if (!isBrowserDebugGeometryNativeDiagnostics(payload)) {
                warnMalformedBrowserWebviewEvent(
                  warnedMalformedEventNamesRef.current,
                  BROWSER_WINDOW_EVENTS.diagnostics,
                  payload,
                );
                return;
              }
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
