import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { IsoDateTimeStringSchema } from "./common";

export const RemoteFeedSyncStatusSchema = s.strictObject({
  feed_id: v.pipe(v.string(), v.minLength(1)),
  last_success_at: v.nullable(IsoDateTimeStringSchema),
});

export const RemoteFeedSyncStatusListSchema = v.array(RemoteFeedSyncStatusSchema);

export type RemoteFeedSyncStatusDto = v.InferOutput<typeof RemoteFeedSyncStatusSchema>;
