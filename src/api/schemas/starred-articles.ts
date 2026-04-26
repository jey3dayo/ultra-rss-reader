import { z } from "zod";
import { ArticleDtoSchema } from "./article";

export const NullableStarredArticlesSchema = z
  .array(ArticleDtoSchema)
  .nullable()
  .transform((value) => value ?? []);

export const NullableStarredCountSchema = z
  .number()
  .int()
  .nullable()
  .transform((value) => value ?? 0);
