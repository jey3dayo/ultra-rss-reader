import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { IsoDateTimeStringSchema, NonnegativeIntegerSchema } from "./common";

export const LocalFeedSyncStatusSchema = s.strictObject({
  feed_id: v.pipe(v.string(), v.minLength(1)),
  last_attempt_at: v.nullable(IsoDateTimeStringSchema),
  last_success_at: v.nullable(IsoDateTimeStringSchema),
  error_kind: v.nullable(
    v.picklist(["private_address_blocked", "validation", "network", "parse", "persistence", "other"]),
  ),
  error_count: NonnegativeIntegerSchema,
  diagnostic_id: v.nullable(v.pipe(v.string(), v.uuid())),
});

export const LocalFeedSyncStatusListSchema = v.array(LocalFeedSyncStatusSchema);

export type LocalFeedSyncStatusDto = v.InferOutput<typeof LocalFeedSyncStatusSchema>;
