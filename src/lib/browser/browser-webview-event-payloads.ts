import { Result } from "@praha/byethrow";
import { parse } from "valibot";
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
import { isSchemaParseError, type RuntimeSchema, type SchemaParseError } from "@/schemas/parse";

export type { BrowserWebviewClosedPayload };

type BrowserWebviewEventPayload =
  | BrowserWebviewState
  | BrowserWebviewFallbackPayload
  | BrowserWebviewClosedPayload
  | BrowserDebugGeometryNativeDiagnostics;

function parseBrowserWebviewPayload(
  schema: typeof BrowserWebviewStateSchema,
  payload: unknown,
): Result.Result<BrowserWebviewState, SchemaParseError>;
function parseBrowserWebviewPayload(
  schema: typeof BrowserWebviewFallbackPayloadSchema,
  payload: unknown,
): Result.Result<BrowserWebviewFallbackPayload, SchemaParseError>;
function parseBrowserWebviewPayload(
  schema: typeof BrowserWebviewClosedPayloadSchema,
  payload: unknown,
): Result.Result<BrowserWebviewClosedPayload, SchemaParseError>;
function parseBrowserWebviewPayload(
  schema: typeof BrowserWebviewDiagnosticsPayloadSchema,
  payload: unknown,
): Result.Result<BrowserDebugGeometryNativeDiagnostics, SchemaParseError>;
function parseBrowserWebviewPayload(
  schema: RuntimeSchema<BrowserWebviewEventPayload>,
  payload: unknown,
): Result.Result<BrowserWebviewEventPayload, SchemaParseError> {
  try {
    return Result.succeed(parse(schema, payload));
  } catch (error) {
    if (isSchemaParseError(error)) {
      return Result.fail(error);
    }
    throw error;
  }
}

export function parseBrowserWebviewStatePayload(
  payload: unknown,
): Result.Result<BrowserWebviewState, SchemaParseError> {
  return parseBrowserWebviewPayload(BrowserWebviewStateSchema, payload);
}

export function parseBrowserWebviewFallbackPayload(
  payload: unknown,
): Result.Result<BrowserWebviewFallbackPayload, SchemaParseError> {
  return parseBrowserWebviewPayload(BrowserWebviewFallbackPayloadSchema, payload);
}

export function parseBrowserWebviewClosedPayload(
  payload: unknown,
): Result.Result<BrowserWebviewClosedPayload | null, SchemaParseError> {
  if (payload === undefined || payload === null) {
    return Result.succeed(null);
  }
  return parseBrowserWebviewPayload(BrowserWebviewClosedPayloadSchema, payload);
}

export function parseBrowserWebviewDiagnosticsPayload(
  payload: unknown,
): Result.Result<BrowserDebugGeometryNativeDiagnostics, SchemaParseError> {
  return parseBrowserWebviewPayload(BrowserWebviewDiagnosticsPayloadSchema, payload);
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

function malformedPayloadIssueSummary(payload: unknown, error: SchemaParseError) {
  // Strict object validation reports one issue per expected key for arrays; the event boundary exposes one root type issue.
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return "invalid_type:<root>";
  }

  return error.issues
    .map((issue) => `${issue.type}:${formatIssuePath(issue.path)}`)
    .toSorted()
    .join(",");
}

function formatIssuePath(path: readonly import("valibot").IssuePathItem[] | undefined): string {
  const keys = path?.map((item) => String(item.key)) ?? [];
  return keys.length > 0 ? keys.join(".") : "<root>";
}

export function warnMalformedBrowserWebviewEvent(
  warnedMalformedPayloadShapes: Set<string>,
  eventName: string,
  payload: unknown,
  error: SchemaParseError,
) {
  const payloadSummary = malformedPayloadSummary(payload);
  const issueSummary = malformedPayloadIssueSummary(payload, error);
  const warningKey = `${eventName}:${payloadSummary}:${issueSummary}`;
  if (warnedMalformedPayloadShapes.has(warningKey)) {
    return;
  }

  warnedMalformedPayloadShapes.add(warningKey);
  console.warn(
    `Ignored malformed embedded browser webview ${eventName} payload: payloadType=${payloadSummary}; issues=${issueSummary}`,
  );
}
