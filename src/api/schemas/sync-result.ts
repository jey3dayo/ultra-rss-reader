import { z } from "zod";

export const AccountSyncErrorSchema = z.object({
  account_id: z.string(),
  account_name: z.string(),
  message: z.string(),
});

export const AccountSyncWarningSchema = z.object({
  account_id: z.string(),
  account_name: z.string(),
  kind: z.enum(["generic", "retry_pending", "retry_scheduled"]).optional(),
  message: z.string(),
  retry_at: z.string().optional(),
  retry_in_seconds: z.number().optional(),
});

export const SyncResultSchema = z.object({
  synced: z.boolean(),
  total: z.number(),
  succeeded: z.number(),
  failed: z.array(AccountSyncErrorSchema),
  warnings: z.array(AccountSyncWarningSchema),
});

export type AccountSyncError = z.infer<typeof AccountSyncErrorSchema>;
export type AccountSyncWarning = z.infer<typeof AccountSyncWarningSchema>;
export type SyncResultDto = z.infer<typeof SyncResultSchema>;
