import { z } from "zod";

export const SyncProgressEventSchema = z
  .object({
    stage: z.enum(["started", "account_started", "account_finished", "finished"]),
    session_id: z.number().int().positive(),
    kind: z.enum(["manual_all", "manual_account", "automatic"]),
    total: z.number().int().nonnegative().finite(),
    completed: z.number().int().nonnegative().finite(),
    account_id: z.string().nullable().optional(),
    account_name: z.string().nullable().optional(),
    success: z.boolean().nullable().optional(),
  })
  .strict();

export type SyncProgressRuntimeEventDto = z.output<typeof SyncProgressEventSchema>;
export type SyncProgressEventDto = SyncProgressRuntimeEventDto;
