import { z } from "zod";

const feedDisplayModeSchema = z.enum(["inherit", "on", "off"]);

export const FeedDtoSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  folder_id: z.string().nullable(),
  title: z.string(),
  url: z.string(),
  site_url: z.string(),
  unread_count: z.number(),
  reader_mode: feedDisplayModeSchema,
  web_preview_mode: feedDisplayModeSchema,
});

export type FeedDto = z.infer<typeof FeedDtoSchema>;
