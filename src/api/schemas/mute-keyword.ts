import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { IsoDateTimeStringSchema } from "./common";

export const MuteKeywordKeywordSchema = v.pipe(v.string(), v.trim(), v.minLength(3));

const nonBlankTrimmedStringSchema = v.pipe(v.string(), v.trim(), v.minLength(1));

export const MuteKeywordScopeSchema = v.picklist(["title", "body", "title_and_body"]);

export const MuteKeywordDtoSchema = s.strictObject({
  id: v.string(),
  keyword: nonBlankTrimmedStringSchema,
  scope: MuteKeywordScopeSchema,
  created_at: IsoDateTimeStringSchema,
  updated_at: IsoDateTimeStringSchema,
});

export const MuteKeywordDtoListSchema = v.array(MuteKeywordDtoSchema);

export type MuteKeywordScope = v.InferOutput<typeof MuteKeywordScopeSchema>;
export type MuteKeywordDto = v.InferOutput<typeof MuteKeywordDtoSchema>;
