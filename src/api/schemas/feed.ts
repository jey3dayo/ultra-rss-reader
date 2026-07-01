import { z } from "zod";
import { NonnegativeIntegerSchema } from "./common";

export const FeedDisplayModeSchema = z.enum(["inherit", "on", "off"]);

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const nonBlankStringSchema = z.string().refine((value) => value.trim().length > 0, {
  message: "Value must not be blank",
});

const feedUrlSchema = z
  .string()
  .min(1)
  .refine((url) => url.trim() === url, {
    message: "Feed URL must not include leading or trailing whitespace",
  })
  .refine((url) => !url.includes("\n") && !url.includes("\r"), {
    message: "Feed URL must not contain newlines",
  })
  .refine(isHttpUrl, {
    message: "Only valid http:// and https:// feed URLs are supported",
  });
const optionalFeedSiteUrlSchema = z.literal("").or(feedUrlSchema);

export const FeedDtoSchema = z.strictObject({
  id: nonBlankStringSchema,
  account_id: nonBlankStringSchema,
  folder_id: z.string().nullable(),
  remote_id: z.string().nullable(),
  title: nonBlankStringSchema,
  url: feedUrlSchema,
  site_url: optionalFeedSiteUrlSchema,
  unread_count: NonnegativeIntegerSchema,
  reader_mode: FeedDisplayModeSchema,
  web_preview_mode: FeedDisplayModeSchema,
});

export const FeedDtoListSchema = z.array(FeedDtoSchema);

export type FeedDto = z.output<typeof FeedDtoSchema>;
