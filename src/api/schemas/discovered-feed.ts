import * as v from "valibot";
import * as s from "@/api/schemas/validation";

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const httpUrlSchema = v.pipe(
  v.string(),
  v.trim(),
  v.minLength(1),
  v.check((url) => !url.includes("\n") && !url.includes("\r"), "Discovered feed URLs must not contain newlines"),
  v.check(isHttpUrl, "Only valid http:// and https:// URLs are supported"),
);

export const DiscoveredFeedDtoSchema = s.strictObject({
  url: httpUrlSchema,
  title: v.string(),
});

export const DiscoveredFeedDtoListSchema = v.array(DiscoveredFeedDtoSchema);

export type DiscoveredFeedDto = v.InferOutput<typeof DiscoveredFeedDtoSchema>;
