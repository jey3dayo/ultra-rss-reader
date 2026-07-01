import { z } from "zod";

export const BROWSER_WEBVIEW_EVENT_NAMES = {
  stateChanged: "browser-webview-state-changed",
  closed: "browser-webview-closed",
  fallback: "browser-webview-fallback",
  diagnostics: "browser-webview-diagnostics",
  debugInput: "browser-webview-debug-input",
} as const;

export type BrowserWebviewEventName = (typeof BROWSER_WEBVIEW_EVENT_NAMES)[keyof typeof BROWSER_WEBVIEW_EVENT_NAMES];

export const BrowserWebviewStateSchema = z.strictObject({
  url: z.string(),
  can_go_back: z.boolean(),
  can_go_forward: z.boolean(),
  is_loading: z.boolean(),
  load_generation: z.number().int().nonnegative(),
});

export type BrowserWebviewState = z.output<typeof BrowserWebviewStateSchema>;

export const BrowserWebviewFallbackPayloadSchema = z.strictObject({
  url: z.string(),
  opened_external: z.boolean(),
  error_message: z.string().nullable(),
});

export type BrowserWebviewFallbackPayload = z.output<typeof BrowserWebviewFallbackPayloadSchema>;

export const BrowserWebviewClosedPayloadSchema = z.strictObject({
  url: z.string(),
  load_generation: z.number().int().nonnegative(),
});

export type BrowserWebviewClosedPayload = z.output<typeof BrowserWebviewClosedPayloadSchema>;

const BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE = 10_000;

const BrowserWebviewDiagnosticsNumberSchema = z
  .number()
  .finite()
  .min(-BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE)
  .max(BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE);

const BrowserWebviewLogicalRectSchema = z.strictObject({
  x: BrowserWebviewDiagnosticsNumberSchema,
  y: BrowserWebviewDiagnosticsNumberSchema,
  width: BrowserWebviewDiagnosticsNumberSchema,
  height: BrowserWebviewDiagnosticsNumberSchema,
});

export const BrowserWebviewDiagnosticsPayloadSchema = z.strictObject({
  action: z.string(),
  requestedLogical: BrowserWebviewLogicalRectSchema,
  appliedLogical: BrowserWebviewLogicalRectSchema,
  scaleFactor: z.number().finite(),
  nativeWebviewBounds: BrowserWebviewLogicalRectSchema.nullable(),
});

export type BrowserWebviewDiagnosticsPayload = z.output<typeof BrowserWebviewDiagnosticsPayloadSchema>;

export const BrowserWebviewDebugInputPayloadSchema = z.string();

export type BrowserWebviewDebugInputPayload = z.output<typeof BrowserWebviewDebugInputPayloadSchema>;

export const BROWSER_WEBVIEW_EVENT_PAYLOAD_SCHEMAS = {
  [BROWSER_WEBVIEW_EVENT_NAMES.stateChanged]: BrowserWebviewStateSchema,
  [BROWSER_WEBVIEW_EVENT_NAMES.closed]: BrowserWebviewClosedPayloadSchema.nullish(),
  [BROWSER_WEBVIEW_EVENT_NAMES.fallback]: BrowserWebviewFallbackPayloadSchema,
  [BROWSER_WEBVIEW_EVENT_NAMES.diagnostics]: BrowserWebviewDiagnosticsPayloadSchema,
  [BROWSER_WEBVIEW_EVENT_NAMES.debugInput]: BrowserWebviewDebugInputPayloadSchema,
} as const satisfies Record<BrowserWebviewEventName, z.ZodType>;
