import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { IsoDateTimeStringSchema } from "./common";

const nullableIsoDateTimeStringSchema = v.nullable(IsoDateTimeStringSchema);

export const AccountSyncStatusSchema = s.strictObject({
  last_success_at: nullableIsoDateTimeStringSchema,
  last_error: v.nullable(v.string()),
  error_count: v.pipe(v.number(), v.integer(), v.minValue(0), v.finite()),
  next_retry_at: nullableIsoDateTimeStringSchema,
});

export type AccountSyncStatusDto = v.InferOutput<typeof AccountSyncStatusSchema>;
