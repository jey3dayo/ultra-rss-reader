import { z } from "zod";

export const AccountDtoSchema = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string(),
  server_url: z.string().nullable(),
  username: z.string().nullable(),
  sync_interval_secs: z.number(),
  sync_on_wake: z.boolean(),
  keep_read_items_days: z.number(),
});

export type AccountDto = z.infer<typeof AccountDtoSchema>;
