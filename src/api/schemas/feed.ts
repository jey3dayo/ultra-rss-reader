import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { NonnegativeIntegerSchema } from "./common";

export const FeedDisplayModeSchema = v.picklist(["inherit", "on", "off"]);

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const nonBlankStringSchema = v.pipe(
  v.string(),
  v.check((value) => value.trim().length > 0, "Value must not be blank"),
);

const feedUrlSchema = v.pipe(
  v.string(),
  v.minLength(1),
  v.check((url) => url.trim() === url, "Feed URL must not include leading or trailing whitespace"),
  v.check((url) => !url.includes("\n") && !url.includes("\r"), "Feed URL must not contain newlines"),
  v.check(isHttpUrl, "Only valid http:// and https:// feed URLs are supported"),
);
const optionalFeedSiteUrlSchema = v.union([v.literal(""), feedUrlSchema]);

export const FeedDtoSchema = s.strictObject({
  id: nonBlankStringSchema,
  account_id: nonBlankStringSchema,
  folder_id: v.nullable(v.string()),
  remote_id: v.nullable(v.string()),
  title: nonBlankStringSchema,
  url: feedUrlSchema,
  site_url: optionalFeedSiteUrlSchema,
  unread_count: NonnegativeIntegerSchema,
  reader_mode: FeedDisplayModeSchema,
  web_preview_mode: FeedDisplayModeSchema,
});

export const FeedDtoListSchema = v.array(FeedDtoSchema);

export type FeedDto = v.InferOutput<typeof FeedDtoSchema>;
