import { Result } from "@praha/byethrow";
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
import type { SchemaParseError } from "@/schemas/parse";

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
  schema: {
    safeParse: (payload: unknown) =>
      | {
          success: true;
          data: BrowserWebviewEventPayload;
        }
      | {
          success: false;
          error: SchemaParseError;
        };
  },
  payload: unknown,
): Result.Result<BrowserWebviewEventPayload, SchemaParseError> {
  const result = schema.safeParse(payload);
  return result.success ? Result.succeed(result.data) : Result.fail(result.error);
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

function malformedPayloadIssueSummary(error: SchemaParseError) {
  return error.issues
    .map((issue) => `${issue.code}:${issue.path.length > 0 ? issue.path.join(".") : "<root>"}`)
    .toSorted()
    .join(",");
}

export function warnMalformedBrowserWebviewEvent(
  warnedMalformedPayloadShapes: Set<string>,
  eventName: string,
  payload: unknown,
  error: SchemaParseError,
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
