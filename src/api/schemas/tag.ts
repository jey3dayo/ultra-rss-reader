import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { NonnegativeIntegerSchema } from "./common";

const nonBlankTrimmedStringSchema = v.pipe(v.string(), v.trim(), v.minLength(1));
const tagColorSchema = v.nullable(
  v.pipe(
    v.string(),
    v.regex(/^#[0-9a-fA-F]{6}$/u),
    v.transform((value) => value.toLowerCase()),
  ),
);

export const TagDtoSchema = s.strictObject({
  id: v.string(),
  name: nonBlankTrimmedStringSchema,
  color: tagColorSchema,
});

export const TagDtoListSchema = v.array(TagDtoSchema);
export const TagArticleCountsSchema = s.record(v.string(), NonnegativeIntegerSchema);

export type TagDto = v.InferOutput<typeof TagDtoSchema>;
