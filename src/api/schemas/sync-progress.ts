import * as v from "valibot";
import * as s from "@/api/schemas/validation";

export const SyncProgressEventSchema = s.strictObject({
  stage: v.picklist(["started", "account_started", "account_finished", "finished"]),
  session_id: v.pipe(v.number(), v.integer(), v.gtValue(0)),
  kind: v.picklist(["manual_all", "manual_account", "automatic"]),
  total: v.pipe(v.number(), v.integer(), v.minValue(0), v.finite()),
  completed: v.pipe(v.number(), v.integer(), v.minValue(0), v.finite()),
  account_id: v.optional(v.nullable(v.string())),
  account_name: v.optional(v.nullable(v.string())),
  success: v.optional(v.nullable(v.boolean())),
});

export type SyncProgressRuntimeEventDto = v.InferOutput<typeof SyncProgressEventSchema>;
export type SyncProgressEventDto = SyncProgressRuntimeEventDto;
