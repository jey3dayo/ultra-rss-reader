import { z } from "zod";

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const httpUrlSchema = z
  .string()
  .trim()
  .min(1)
  .refine((url) => !url.includes("\n") && !url.includes("\r"), {
    message: "Discovered feed URLs must not contain newlines",
  })
  .refine(isHttpUrl, {
    message: "Only valid http:// and https:// URLs are supported",
  });

export const DiscoveredFeedDtoSchema = z.object({
  url: httpUrlSchema,
  title: z.string(),
});

export const DiscoveredFeedDtoListSchema = z.array(DiscoveredFeedDtoSchema);

export type DiscoveredFeedDto = z.output<typeof DiscoveredFeedDtoSchema>;
