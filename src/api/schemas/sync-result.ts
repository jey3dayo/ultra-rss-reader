import { z } from "zod";
import { IsoDateTimeStringSchema } from "./common";

const nonnegativeIntegerSchema = z.number().int().nonnegative().finite();
const nonBlankTrimmedStringSchema = z.string().trim().min(1);
const accountNameSchema = z.string().trim();
export const SyncIssueOwnerSchema = z.enum(["account", "feed", "credential", "scheduler"]);

const AccountSyncErrorSchema = z.strictObject({
  account_id: z.string(),
  account_name: accountNameSchema,
  action_owner: SyncIssueOwnerSchema.optional(),
  message: nonBlankTrimmedStringSchema,
});

export const AccountSyncWarningSchema = z.strictObject({
  account_id: z.string(),
  account_name: accountNameSchema,
  action_owner: SyncIssueOwnerSchema.optional(),
  kind: z.enum(["generic", "retry_pending", "retry_scheduled"]).optional(),
  message: nonBlankTrimmedStringSchema,
  retry_at: IsoDateTimeStringSchema.nullish(),
  retry_in_seconds: nonnegativeIntegerSchema.nullish(),
});

export const SyncResultSchema = z
  .strictObject({
    synced: z.boolean(),
    total: nonnegativeIntegerSchema,
    succeeded: nonnegativeIntegerSchema,
    failed: z.array(AccountSyncErrorSchema),
    warnings: z.array(AccountSyncWarningSchema),
  })
  .refine((result) => result.total === result.succeeded + result.failed.length, {
    message: "total must match succeeded plus failed count",
    path: ["total"],
  });

export const SyncWarningPayloadSchema = z.array(AccountSyncWarningSchema);
export const SyncCompletedPayloadSchema = z.null();

export type AccountSyncError = z.output<typeof AccountSyncErrorSchema>;
export type AccountSyncWarning = z.output<typeof AccountSyncWarningSchema>;
export type SyncWarningPayload = z.output<typeof SyncWarningPayloadSchema>;
export type SyncCompletedPayload = z.output<typeof SyncCompletedPayloadSchema>;
export type SyncIssueOwner = z.output<typeof SyncIssueOwnerSchema>;
export type SyncResultDto = z.output<typeof SyncResultSchema>;
