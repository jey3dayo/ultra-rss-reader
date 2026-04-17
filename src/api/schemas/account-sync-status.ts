import { z } from "zod";

export const AccountSyncStatusSchema = z.object({
  last_success_at: z.string().nullable(),
  last_error: z.string().nullable(),
  error_count: z.number().int(),
  next_retry_at: z.string().nullable(),
});

export type AccountSyncStatusDto = z.infer<typeof AccountSyncStatusSchema>;
