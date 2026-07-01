import { z } from "zod";
import { IsoDateTimeStringSchema } from "./common";

const nullableIsoDateTimeStringSchema = IsoDateTimeStringSchema.nullable();

export const AccountSyncStatusSchema = z.strictObject({
  last_success_at: nullableIsoDateTimeStringSchema,
  last_error: z.string().nullable(),
  error_count: z.number().int().nonnegative().finite(),
  next_retry_at: nullableIsoDateTimeStringSchema,
});

export type AccountSyncStatusDto = z.output<typeof AccountSyncStatusSchema>;
