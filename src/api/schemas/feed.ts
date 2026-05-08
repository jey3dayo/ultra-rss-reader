import { z } from "zod";

export const FeedDisplayModeSchema = z.enum(["inherit", "on", "off"]);

export const FeedDtoSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  folder_id: z.string().nullable(),
  title: z.string(),
  url: z.string(),
  site_url: z.string(),
  unread_count: z.number(),
  reader_mode: FeedDisplayModeSchema,
  web_preview_mode: FeedDisplayModeSchema,
});

export const FeedDtoListSchema = z.array(FeedDtoSchema);

export type FeedDto = z.infer<typeof FeedDtoSchema>;
