import { z } from "zod";

export const BrowserWebviewStateSchema = z
  .object({
    url: z.string(),
    can_go_back: z.boolean(),
    can_go_forward: z.boolean(),
    is_loading: z.boolean(),
    load_generation: z.number().int().nonnegative(),
  })
  .strict();

export type BrowserWebviewState = z.output<typeof BrowserWebviewStateSchema>;

export const BrowserWebviewFallbackPayloadSchema = z
  .object({
    url: z.string(),
    opened_external: z.boolean(),
    error_message: z.string().nullable(),
  })
  .strict();

export type BrowserWebviewFallbackPayload = z.output<typeof BrowserWebviewFallbackPayloadSchema>;

const BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE = 10_000;

const BrowserWebviewDiagnosticsNumberSchema = z
  .number()
  .finite()
  .min(-BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE)
  .max(BROWSER_WEBVIEW_DIAGNOSTICS_MAX_RECT_VALUE);

const BrowserWebviewLogicalRectSchema = z
  .object({
    x: BrowserWebviewDiagnosticsNumberSchema,
    y: BrowserWebviewDiagnosticsNumberSchema,
    width: BrowserWebviewDiagnosticsNumberSchema,
    height: BrowserWebviewDiagnosticsNumberSchema,
  })
  .strict();

export const BrowserWebviewDiagnosticsPayloadSchema = z
  .object({
    action: z.string(),
    requestedLogical: BrowserWebviewLogicalRectSchema,
    appliedLogical: BrowserWebviewLogicalRectSchema,
    scaleFactor: z.number().finite(),
    nativeWebviewBounds: BrowserWebviewLogicalRectSchema.nullable(),
  })
  .strict();

export type BrowserWebviewDiagnosticsPayload = z.output<typeof BrowserWebviewDiagnosticsPayloadSchema>;
