import { z } from "zod";

export const FeedDtoSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  folder_id: z.string().nullable(),
  title: z.string(),
  url: z.string(),
  site_url: z.string(),
  unread_count: z.number(),
  display_mode: z.string(),
});

export type FeedDto = z.infer<typeof FeedDtoSchema>;
