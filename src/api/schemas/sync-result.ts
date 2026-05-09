import { z } from "zod";
import { IsoDateTimeStringSchema } from "./common";

const nonnegativeIntegerSchema = z.number().int().nonnegative().finite();
const nonBlankTrimmedStringSchema = z.string().trim().min(1);
const accountNameSchema = z.string().trim();

const AccountSyncErrorSchema = z
  .object({
    account_id: z.string(),
    account_name: accountNameSchema,
    message: nonBlankTrimmedStringSchema,
  })
  .strict();

export const AccountSyncWarningSchema = z
  .object({
    account_id: z.string(),
    account_name: accountNameSchema,
    kind: z.enum(["generic", "retry_pending", "retry_scheduled"]).optional(),
    message: nonBlankTrimmedStringSchema,
    retry_at: IsoDateTimeStringSchema.optional(),
    retry_in_seconds: nonnegativeIntegerSchema.optional(),
  })
  .strict();

export const SyncResultSchema = z
  .object({
    synced: z.boolean(),
    total: nonnegativeIntegerSchema,
    succeeded: nonnegativeIntegerSchema,
    failed: z.array(AccountSyncErrorSchema),
    warnings: z.array(AccountSyncWarningSchema),
  })
  .strict();

export type AccountSyncError = z.output<typeof AccountSyncErrorSchema>;
export type AccountSyncWarning = z.output<typeof AccountSyncWarningSchema>;
export type SyncResultDto = z.output<typeof SyncResultSchema>;
