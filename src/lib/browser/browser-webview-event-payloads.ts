import { Result } from "@praha/byethrow";
import type { ZodError } from "zod";
import {
  BrowserWebviewClosedPayloadSchema,
  type BrowserWebviewClosedPayload,
  BrowserWebviewDiagnosticsPayloadSchema,
  type BrowserWebviewFallbackPayload,
  BrowserWebviewFallbackPayloadSchema,
  type BrowserWebviewState,
  BrowserWebviewStateSchema,
} from "@/api/schemas/browser-webview";
import type { BrowserDebugGeometryNativeDiagnostics } from "@/lib/browser/browser-debug-geometry";

export type { BrowserWebviewClosedPayload };

export function parseBrowserWebviewStatePayload(
  payload: unknown,
): Result.Result<BrowserWebviewState, ZodError> {
  const result = BrowserWebviewStateSchema.safeParse(payload);
  return result.success ? Result.succeed(result.data) : Result.fail(result.error);
}

export function parseBrowserWebviewFallbackPayload(
  payload: unknown,
): Result.Result<BrowserWebviewFallbackPayload, ZodError> {
  const result = BrowserWebviewFallbackPayloadSchema.safeParse(payload);
  return result.success ? Result.succeed(result.data) : Result.fail(result.error);
}

export function parseBrowserWebviewClosedPayload(
  payload: unknown,
): Result.Result<BrowserWebviewClosedPayload | null, ZodError> {
  if (payload === undefined || payload === null) {
    return Result.succeed(null);
  }
  const result = BrowserWebviewClosedPayloadSchema.safeParse(payload);
  return result.success ? Result.succeed(result.data) : Result.fail(result.error);
}

export function parseBrowserWebviewDiagnosticsPayload(
  payload: unknown,
): Result.Result<BrowserDebugGeometryNativeDiagnostics, ZodError> {
  const result = BrowserWebviewDiagnosticsPayloadSchema.safeParse(payload);
  return result.success ? Result.succeed(result.data) : Result.fail(result.error);
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
