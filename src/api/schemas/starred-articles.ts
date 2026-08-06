import * as v from "valibot";
import { ArticleDtoSchema } from "./article";

export const NullableStarredArticlesSchema = v.pipe(
  v.nullable(v.array(ArticleDtoSchema)),
  v.transform((value) => value ?? []),
);

export const NullableStarredCountSchema = v.pipe(
  v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0))),
  v.transform((value) => value ?? 0),
);
