import { Result } from "@praha/byethrow";
import type { ZodError } from "zod";
import {
  type BrowserWebviewClosedPayload,
  BrowserWebviewClosedPayloadSchema,
  BrowserWebviewDiagnosticsPayloadSchema,
  type BrowserWebviewFallbackPayload,
  BrowserWebviewFallbackPayloadSchema,
  type BrowserWebviewState,
  BrowserWebviewStateSchema,
} from "@/api/schemas/browser-webview";
import type { BrowserDebugGeometryNativeDiagnostics } from "@/lib/browser/browser-debug-geometry";

export type { BrowserWebviewClosedPayload };

type BrowserWebviewEventPayload =
  | BrowserWebviewState
  | BrowserWebviewFallbackPayload
  | BrowserWebviewClosedPayload
  | BrowserDebugGeometryNativeDiagnostics;

function parseBrowserWebviewPayload(
  schema: typeof BrowserWebviewStateSchema,
  payload: unknown,
): Result.Result<BrowserWebviewState, ZodError>;
function parseBrowserWebviewPayload(
  schema: typeof BrowserWebviewFallbackPayloadSchema,
  payload: unknown,
): Result.Result<BrowserWebviewFallbackPayload, ZodError>;
function parseBrowserWebviewPayload(
  schema: typeof BrowserWebviewClosedPayloadSchema,
  payload: unknown,
): Result.Result<BrowserWebviewClosedPayload, ZodError>;
function parseBrowserWebviewPayload(
  schema: typeof BrowserWebviewDiagnosticsPayloadSchema,
  payload: unknown,
): Result.Result<BrowserDebugGeometryNativeDiagnostics, ZodError>;
function parseBrowserWebviewPayload(
  schema: {
    safeParse: (payload: unknown) =>
      | {
          success: true;
          data: BrowserWebviewEventPayload;
        }
      | {
          success: false;
          error: ZodError;
        };
  },
  payload: unknown,
): Result.Result<BrowserWebviewEventPayload, ZodError> {
  const result = schema.safeParse(payload);
  return result.success ? Result.succeed(result.data) : Result.fail(result.error);
}

export function parseBrowserWebviewStatePayload(payload: unknown): Result.Result<BrowserWebviewState, ZodError> {
  return parseBrowserWebviewPayload(BrowserWebviewStateSchema, payload);
}

export function parseBrowserWebviewFallbackPayload(
  payload: unknown,
): Result.Result<BrowserWebviewFallbackPayload, ZodError> {
  return parseBrowserWebviewPayload(BrowserWebviewFallbackPayloadSchema, payload);
}

export function parseBrowserWebviewClosedPayload(
  payload: unknown,
): Result.Result<BrowserWebviewClosedPayload | null, ZodError> {
  if (payload === undefined || payload === null) {
    return Result.succeed(null);
  }
  return parseBrowserWebviewPayload(BrowserWebviewClosedPayloadSchema, payload);
}

export function parseBrowserWebviewDiagnosticsPayload(
  payload: unknown,
): Result.Result<BrowserDebugGeometryNativeDiagnostics, ZodError> {
  return parseBrowserWebviewPayload(BrowserWebviewDiagnosticsPayloadSchema, payload);
}

export function malformedPayloadSummary(payload: unknown) {
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

export function malformedPayloadIssueSummary(error: ZodError) {
  return error.issues
    .map((issue) => `${issue.code}:${issue.path.length > 0 ? issue.path.join(".") : "<root>"}`)
    .toSorted()
    .join(",");
}

export function warnMalformedBrowserWebviewEvent(
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
