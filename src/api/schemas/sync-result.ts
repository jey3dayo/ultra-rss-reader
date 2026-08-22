import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { IsoDateTimeStringSchema } from "./common";

const nonnegativeIntegerSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.finite());
const nonBlankTrimmedStringSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
const accountNameSchema = v.pipe(v.string(), v.trim());
const feedTitleSchema = v.pipe(v.string(), v.trim());
const mutationLabelSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
export const SyncIssueOwnerSchema = v.picklist(["account", "feed", "credential", "scheduler"]);

const AccountSyncErrorSchema = s.strictObject({
  account_id: v.string(),
  account_name: accountNameSchema,
  action_owner: v.optional(SyncIssueOwnerSchema),
  message: nonBlankTrimmedStringSchema,
});

/**
 * Structured detail for a sync warning, resolved into a localized message by
 * `sync-result-feedback.ts` (`sidebar:sync_warning_detail.<type>` /
 * `settings:sync_warning_detail.<type>` locale keys). Additive alongside
 * `kind`/`message`/retry fields on `AccountSyncWarningSchema` below; mirrors
 * `AccountSyncWarningDetail` in `src-tauri/src/commands/dto/sync.rs`.
 *
 * `i18next-locale-contract.node.test.ts` pins the 13 variants against the
 * Rust enum and asserts en/ja locale keys exist for each.
 */
export const AccountSyncWarningDetailSchema = v.variant("type", [
  s.unwrapStrictObjectSchema(
    s.strictObject({ type: v.literal("pending_mutation_retry"), mutation: mutationLabelSchema }),
  ),
  s.unwrapStrictObjectSchema(
    s.strictObject({ type: v.literal("dropped_pending_mutation"), mutation: mutationLabelSchema }),
  ),
  s.unwrapStrictObjectSchema(
    s.strictObject({ type: v.literal("deleted_greader_folders"), count: nonnegativeIntegerSchema }),
  ),
  s.unwrapStrictObjectSchema(
    s.strictObject({
      type: v.literal("feed_skipped_entries"),
      feed_title: feedTitleSchema,
      count: nonnegativeIntegerSchema,
    }),
  ),
  s.unwrapStrictObjectSchema(
    s.strictObject({
      type: v.literal("feed_articles_vanished"),
      feed_title: feedTitleSchema,
      count_before: nonnegativeIntegerSchema,
    }),
  ),
  s.unwrapStrictObjectSchema(
    s.strictObject({
      type: v.literal("account_skipped_entries"),
      account_name: accountNameSchema,
      count: nonnegativeIntegerSchema,
    }),
  ),
  s.unwrapStrictObjectSchema(
    s.strictObject({
      type: v.literal("local_feed_sync_failed"),
      feed_title: feedTitleSchema,
      message: nonBlankTrimmedStringSchema,
    }),
  ),
  s.unwrapStrictObjectSchema(
    s.strictObject({
      type: v.literal("local_account_sync_operation_failed"),
      operation: nonBlankTrimmedStringSchema,
      message: nonBlankTrimmedStringSchema,
    }),
  ),
  s.unwrapStrictObjectSchema(
    s.strictObject({
      type: v.literal("local_import_result"),
      conflicted: nonnegativeIntegerSchema,
      rejected_files: nonnegativeIntegerSchema,
      rejected_operations: nonnegativeIntegerSchema,
    }),
  ),
  s.unwrapStrictObjectSchema(
    s.strictObject({ type: v.literal("startup_repair_marker_failed"), message: nonBlankTrimmedStringSchema }),
  ),
  s.unwrapStrictObjectSchema(
    s.strictObject({ type: v.literal("scheduler_load_failed"), message: nonBlankTrimmedStringSchema }),
  ),
  s.unwrapStrictObjectSchema(
    s.strictObject({
      type: v.literal("backoff_persist_failed"),
      account_name: accountNameSchema,
      message: nonBlankTrimmedStringSchema,
    }),
  ),
  s.unwrapStrictObjectSchema(
    s.strictObject({
      type: v.literal("background_sync_retry_scheduled"),
      account_name: accountNameSchema,
    }),
  ),
]);

type AccountSyncWarningDetailValue = v.InferOutput<typeof AccountSyncWarningDetailSchema>;

/**
 * Detail is optional and self-healing: a missing `detail` (older backend) or
 * an unrecognized `type` (newer backend, older frontend) both normalize to
 * `null` instead of throwing, so the caller falls back to the existing
 * kind/message summary. See `.claude/rules/schema-boundary.md`.
 */
const AccountSyncWarningDetailFieldSchema = v.optional(
  v.pipe(
    v.unknown(),
    v.transform((input): AccountSyncWarningDetailValue | null => {
      const result = v.safeParse(AccountSyncWarningDetailSchema, input);
      return result.success ? result.output : null;
    }),
  ),
  null,
);

export const AccountSyncWarningSchema = s.strictObject({
  account_id: v.string(),
  account_name: accountNameSchema,
  action_owner: v.optional(SyncIssueOwnerSchema),
  kind: v.optional(v.picklist(["generic", "retry_pending", "retry_scheduled"])),
  message: nonBlankTrimmedStringSchema,
  retry_at: v.nullish(IsoDateTimeStringSchema),
  retry_in_seconds: v.nullish(nonnegativeIntegerSchema),
  detail: AccountSyncWarningDetailFieldSchema,
});

export const SyncResultSchema = v.pipe(
  s.strictObject({
    synced: v.boolean(),
    total: nonnegativeIntegerSchema,
    succeeded: nonnegativeIntegerSchema,
    failed: v.array(AccountSyncErrorSchema),
    warnings: v.array(AccountSyncWarningSchema),
  }),
  v.forward(
    v.check(
      (result) => result.total === result.succeeded + result.failed.length,
      "total must match succeeded plus failed count",
    ),
    ["total"],
  ),
);

export const SyncWarningPayloadSchema = v.array(AccountSyncWarningSchema);
export const SyncCompletedPayloadSchema = v.null_();

export type AccountSyncError = v.InferOutput<typeof AccountSyncErrorSchema>;
export type AccountSyncWarning = v.InferOutput<typeof AccountSyncWarningSchema>;
export type AccountSyncWarningDetail = v.InferOutput<typeof AccountSyncWarningDetailSchema>;
export type SyncWarningPayload = v.InferOutput<typeof SyncWarningPayloadSchema>;
export type SyncCompletedPayload = v.InferOutput<typeof SyncCompletedPayloadSchema>;
export type SyncIssueOwner = v.InferOutput<typeof SyncIssueOwnerSchema>;
export type SyncResultDto = v.InferOutput<typeof SyncResultSchema>;
