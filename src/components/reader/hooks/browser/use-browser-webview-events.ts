import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useLayoutEffect, useRef } from "react";
import type { ZodError } from "zod";
import { z } from "zod";
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
  isClosedEventCurrent?: (payload: BrowserWebviewClosedPayload) => boolean;
  onDiagnostics: (payload: BrowserDebugGeometryNativeDiagnostics) => void;
};

type UseBrowserWebviewEventsResult = () => Promise<void>;

type BrowserWebviewClosedPayload = {
  url: string;
  load_generation: number;
};

const BrowserWebviewClosedPayloadSchema = z
  .object({
    url: z.string(),
    load_generation: z.number().int().nonnegative(),
  })
  .strict();

function parseBrowserWebviewStatePayload(payload: unknown): Result.Result<BrowserWebviewState, ZodError> {
  const result = BrowserWebviewStateSchema.safeParse(payload);
  return result.success ? Result.succeed(result.data) : Result.fail(result.error);
}

function parseBrowserWebviewFallbackPayload(payload: unknown): Result.Result<BrowserWebviewFallbackPayload, ZodError> {
  const result = BrowserWebviewFallbackPayloadSchema.safeParse(payload);
  return result.success ? Result.succeed(result.data) : Result.fail(result.error);
}

function parseBrowserWebviewClosedPayload(
  payload: unknown,
): Result.Result<BrowserWebviewClosedPayload | null, ZodError> {
  if (payload === undefined || payload === null) {
    return Result.succeed(null);
  }
  const result = BrowserWebviewClosedPayloadSchema.safeParse(payload);
  return result.success ? Result.succeed(result.data) : Result.fail(result.error);
}

function parseBrowserWebviewDiagnosticsPayload(
  payload: unknown,
): Result.Result<BrowserDebugGeometryNativeDiagnostics, ZodError> {
  const result = BrowserWebviewDiagnosticsPayloadSchema.safeParse(payload);
  return result.success ? Result.succeed(result.data) : Result.fail(result.error);
}

function malformedPayloadSummary(payload: unknown) {
  if (Array.isArray(payload)) {
    return "array";
  }
  if (payload === null) {
    return "null";
  }
  if (typeof payload === "object") {
    return `object(keys=${Object.keys(payload).toSorted().join(",")})`;
  }
  return typeof payload;
}

function malformedPayloadIssueSummary(error: ZodError) {
  return error.issues
    .map((issue) => `${issue.code}:${issue.path.length > 0 ? issue.path.join(".") : "<root>"}`)
    .toSorted()
    .join(",");
}

function warnMalformedBrowserWebviewEvent(
  warnedMalformedPayloadShapes: Set<string>,
  eventName: string,
  payload: unknown,
  error: ZodError,
) {
  const payloadSummary = malformedPayloadSummary(payload);
  const issueSummary = malformedPayloadIssueSummary(error);
  const warningKey = `${eventName}:${payloadSummary}:${issueSummary}`;
  if (warnedMalformedPayloadShapes.has(warningKey)) {
    return;
  }

  warnedMalformedPayloadShapes.add(warningKey);
  console.warn(
    `Ignored malformed embedded browser webview ${eventName} payload: payloadType=${payloadSummary}; issues=${issueSummary}`,
  );
}

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
        subscription: listen<unknown>(BROWSER_WINDOW_EVENTS.stateChanged, ({ payload }) => {
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
        subscription: listen<unknown>(BROWSER_WINDOW_EVENTS.fallback, ({ payload }) => {
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
        subscription: listen<unknown>(BROWSER_WINDOW_EVENTS.closed, ({ payload }) => {
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
              subscription: listen<unknown>(BROWSER_WINDOW_EVENTS.diagnostics, ({ payload }) => {
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
