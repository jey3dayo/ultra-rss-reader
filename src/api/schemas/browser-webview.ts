import * as v from "valibot";
import * as s from "@/api/schemas/validation";

export const BROWSER_WEBVIEW_EVENT_NAMES = {
  stateChanged: "browser-webview-state-changed",
  closed: "browser-webview-closed",
  fallback: "browser-webview-fallback",
  diagnostics: "browser-webview-diagnostics",
  debugInput: "browser-webview-debug-input",
} as const;

export type BrowserWebviewEventName = (typeof BROWSER_WEBVIEW_EVENT_NAMES)[keyof typeof BROWSER_WEBVIEW_EVENT_NAMES];

export const BrowserWebviewStateSchema = s.strictObject({
  url: v.string(),
  can_go_back: v.boolean(),
  can_go_forward: v.boolean(),
  is_loading: v.boolean(),
  load_generation: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export type BrowserWebviewState = v.InferOutput<typeof BrowserWebviewStateSchema>;

export const BrowserWebviewFallbackPayloadSchema = s.strictObject({
  url: v.string(),
  opened_external: v.boolean(),
  error_message: v.nullable(v.string()),
});

export type BrowserWebviewFallbackPayload = v.InferOutput<typeof BrowserWebviewFallbackPayloadSchema>;

export const BrowserWebviewClosedPayloadSchema = s.strictObject({
  url: v.string(),
  load_generation: v.pipe(v.number(), v.integer(), v.minValue(0)),
});

export type BrowserWebviewClosedPayload = v.InferOutput<typeof BrowserWebviewClosedPayloadSchema>;

const BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE = 10_000;

const BrowserWebviewDiagnosticsNumberSchema = v.pipe(
  v.number(),
  v.finite(),
  v.minValue(-BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE),
  v.maxValue(BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE),
);

const BrowserWebviewLogicalRectSchema = s.strictObject({
  x: BrowserWebviewDiagnosticsNumberSchema,
  y: BrowserWebviewDiagnosticsNumberSchema,
  width: BrowserWebviewDiagnosticsNumberSchema,
  height: BrowserWebviewDiagnosticsNumberSchema,
});

export const BrowserWebviewDiagnosticsPayloadSchema = s.strictObject({
  action: v.string(),
  requestedLogical: BrowserWebviewLogicalRectSchema,
  appliedLogical: BrowserWebviewLogicalRectSchema,
  scaleFactor: v.pipe(v.number(), v.finite()),
  nativeWebviewBounds: v.nullable(BrowserWebviewLogicalRectSchema),
});

export type BrowserWebviewDiagnosticsPayload = v.InferOutput<typeof BrowserWebviewDiagnosticsPayloadSchema>;

export const BrowserWebviewDebugInputPayloadSchema = v.string();

export type BrowserWebviewDebugInputPayload = v.InferOutput<typeof BrowserWebviewDebugInputPayloadSchema>;

export const BROWSER_WEBVIEW_EVENT_PAYLOAD_SCHEMAS = {
  [BROWSER_WEBVIEW_EVENT_NAMES.stateChanged]: BrowserWebviewStateSchema,
  [BROWSER_WEBVIEW_EVENT_NAMES.closed]: v.nullish(BrowserWebviewClosedPayloadSchema),
  [BROWSER_WEBVIEW_EVENT_NAMES.fallback]: BrowserWebviewFallbackPayloadSchema,
  [BROWSER_WEBVIEW_EVENT_NAMES.diagnostics]: BrowserWebviewDiagnosticsPayloadSchema,
  [BROWSER_WEBVIEW_EVENT_NAMES.debugInput]: BrowserWebviewDebugInputPayloadSchema,
} as const satisfies Record<BrowserWebviewEventName, v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>;
