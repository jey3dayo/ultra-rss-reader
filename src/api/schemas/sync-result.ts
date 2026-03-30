import { z } from "zod";

export const AccountSyncErrorSchema = z.object({
  account_id: z.string(),
  account_name: z.string(),
  message: z.string(),
});

export const SyncResultSchema = z.object({
  synced: z.boolean(),
  total: z.number(),
  succeeded: z.number(),
  failed: z.array(AccountSyncErrorSchema),
});

export type AccountSyncError = z.infer<typeof AccountSyncErrorSchema>;
export type SyncResultDto = z.infer<typeof SyncResultSchema>;
