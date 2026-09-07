import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { unwrapObjectSchema } from "@/api/schemas/validation";

// Schemas for the local-only read-state diagnostics IPC boundary (see
// tmp/read-state/design-contract.md). Every field is a bounded enum, a small bounded number, or
// an opaque per-request id; none may ever carry an article id, feed id, account id, title, URL,
// body text, search string, token, local path, SQL, or a raw error message.

// Mirrors READ_DIAGNOSTIC_REQUEST_ID_MAX_CHARS in src-tauri/src/commands/dto/read_diagnostics.rs.
export const READ_DIAGNOSTIC_REQUEST_ID_MAX_CHARS = 64;
// Mirrors READ_DIAGNOSTICS_BATCH_MAX_EVENTS in the same Rust module.
export const READ_DIAGNOSTICS_BATCH_MAX_EVENTS = 64;

const readDiagnosticRequestIdSchema = v.pipe(
  v.string(),
  v.regex(
    new RegExp(`^[A-Za-z0-9-]{1,${READ_DIAGNOSTIC_REQUEST_ID_MAX_CHARS}}$`, "u"),
    "Diagnostic request id must be 1-64 ASCII letters, digits, or hyphens",
  ),
);
const readDiagnosticGenerationSchema = v.pipe(v.number(), v.integer(), v.minValue(0));
const readDiagnosticDelayMsSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(60_000));
const readDiagnosticDurationMsSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(60_000));
const readDiagnosticElapsedMsSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(600_000));
const readDiagnosticDriftMsSchema = v.pipe(v.number(), v.integer(), v.minValue(-60_000), v.maxValue(60_000));

export const readDiagnosticSkipReasonSchema = v.picklist([
  "already_read",
  "not_reading",
  "preference_never",
  "manual_unread_suppressed",
  "already_requested",
]);
export const readDiagnosticCancelReasonSchema = v.picklist([
  "article_changed",
  "account_changed",
  "preference_changed",
  "engagement_changed",
  "effect_cleanup",
]);
export const readDiagnosticOutcomeSchema = v.picklist(["success", "failure"]);
export const readDiagnosticErrorClassSchema = v.picklist(["user_visible", "retryable", "unknown"]);

export type ReadDiagnosticSkipReason = v.InferOutput<typeof readDiagnosticSkipReasonSchema>;
export type ReadDiagnosticCancelReason = v.InferOutput<typeof readDiagnosticCancelReasonSchema>;
export type ReadDiagnosticOutcome = v.InferOutput<typeof readDiagnosticOutcomeSchema>;
export type ReadDiagnosticErrorClass = v.InferOutput<typeof readDiagnosticErrorClassSchema>;

// The diagnostic context threaded through mark_article_read. Source is always "auto" here: this
// context only ever travels with the reader auto-mark flow, and manual mark-read call sites do
// not supply one (the backend classifies those as manual and generates its own operation id).
export const readDiagnosticContextArgs = s.object({
  requestId: readDiagnosticRequestIdSchema,
  source: v.literal("auto"),
});

const scheduledEventArgs = s.object({
  event: v.literal("scheduled"),
  requestId: readDiagnosticRequestIdSchema,
  generation: readDiagnosticGenerationSchema,
  delayMs: readDiagnosticDelayMsSchema,
});
const skippedEventArgs = s.object({
  event: v.literal("skipped"),
  requestId: readDiagnosticRequestIdSchema,
  generation: readDiagnosticGenerationSchema,
  reason: readDiagnosticSkipReasonSchema,
});
const cancelledEventArgs = s.object({
  event: v.literal("cancelled"),
  requestId: readDiagnosticRequestIdSchema,
  generation: readDiagnosticGenerationSchema,
  reason: readDiagnosticCancelReasonSchema,
});
const dispatchedEventArgs = s.object({
  event: v.literal("dispatched"),
  requestId: readDiagnosticRequestIdSchema,
  generation: readDiagnosticGenerationSchema,
  driftMs: readDiagnosticDriftMsSchema,
});
const settledEventArgs = s.object({
  event: v.literal("settled"),
  requestId: readDiagnosticRequestIdSchema,
  generation: readDiagnosticGenerationSchema,
  outcome: readDiagnosticOutcomeSchema,
  durationMs: readDiagnosticDurationMsSchema,
  errorClass: v.optional(readDiagnosticErrorClassSchema),
  staleOwner: v.boolean(),
});
const pendingSlowEventArgs = s.object({
  event: v.literal("pending_slow"),
  requestId: readDiagnosticRequestIdSchema,
  generation: readDiagnosticGenerationSchema,
  elapsedMs: readDiagnosticElapsedMsSchema,
});

export const readDiagnosticEventArgs = v.variant("event", [
  unwrapObjectSchema(scheduledEventArgs),
  unwrapObjectSchema(skippedEventArgs),
  unwrapObjectSchema(cancelledEventArgs),
  unwrapObjectSchema(dispatchedEventArgs),
  unwrapObjectSchema(settledEventArgs),
  unwrapObjectSchema(pendingSlowEventArgs),
]);

export type ReadDiagnosticEventArgs = v.InferOutput<typeof readDiagnosticEventArgs>;

export const recordReadDiagnosticsBatchArgs = s.object({
  events: v.pipe(v.array(readDiagnosticEventArgs), v.minLength(1), v.maxLength(READ_DIAGNOSTICS_BATCH_MAX_EVENTS)),
});
