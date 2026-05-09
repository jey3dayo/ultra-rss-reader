import { z } from "zod";

const nullableIsoDateTimeStringSchema = z.string().datetime({ offset: true }).nullable();

export const AccountSyncStatusSchema = z.object({
  last_success_at: nullableIsoDateTimeStringSchema,
  last_error: z.string().nullable(),
  error_count: z.number().int().nonnegative(),
  next_retry_at: nullableIsoDateTimeStringSchema,
});

export type AccountSyncStatusDto = z.output<typeof AccountSyncStatusSchema>;
