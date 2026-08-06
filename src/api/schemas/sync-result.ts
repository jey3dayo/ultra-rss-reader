import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { IsoDateTimeStringSchema } from "./common";

const nonnegativeIntegerSchema = v.pipe(v.number(), v.integer(), v.minValue(0), v.finite());
const nonBlankTrimmedStringSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
const accountNameSchema = v.pipe(v.string(), v.trim());
export const SyncIssueOwnerSchema = v.picklist(["account", "feed", "credential", "scheduler"]);

const AccountSyncErrorSchema = s.strictObject({
  account_id: v.string(),
  account_name: accountNameSchema,
  action_owner: v.optional(SyncIssueOwnerSchema),
  message: nonBlankTrimmedStringSchema,
});

export const AccountSyncWarningSchema = s.strictObject({
  account_id: v.string(),
  account_name: accountNameSchema,
  action_owner: v.optional(SyncIssueOwnerSchema),
  kind: v.optional(v.picklist(["generic", "retry_pending", "retry_scheduled"])),
  message: nonBlankTrimmedStringSchema,
  retry_at: v.nullish(IsoDateTimeStringSchema),
  retry_in_seconds: v.nullish(nonnegativeIntegerSchema),
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
export type SyncWarningPayload = v.InferOutput<typeof SyncWarningPayloadSchema>;
export type SyncCompletedPayload = v.InferOutput<typeof SyncCompletedPayloadSchema>;
export type SyncIssueOwner = v.InferOutput<typeof SyncIssueOwnerSchema>;
export type SyncResultDto = v.InferOutput<typeof SyncResultSchema>;
