import { z } from "zod";
import { NonnegativeIntegerSchema } from "./common";

const nonBlankTrimmedStringSchema = z.string().trim().min(1);
const tagColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase())
  .nullable();

export const TagDtoSchema = z.strictObject({
  id: z.string(),
  name: nonBlankTrimmedStringSchema,
  color: tagColorSchema,
});

export const TagDtoListSchema = z.array(TagDtoSchema);
export const TagArticleCountsSchema = z.record(z.string(), NonnegativeIntegerSchema);

export type TagDto = z.output<typeof TagDtoSchema>;
