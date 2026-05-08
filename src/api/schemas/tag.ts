import { z } from "zod";
import { NonnegativeIntegerSchema } from "./common";

export const TagDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable(),
});

export const TagDtoListSchema = z.array(TagDtoSchema);
export const TagArticleCountsSchema = z.record(z.string(), NonnegativeIntegerSchema);

export type TagDto = z.infer<typeof TagDtoSchema>;
