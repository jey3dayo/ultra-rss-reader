import { z } from "zod";
import { IsoDateTimeStringSchema } from "./common";

export const MuteKeywordKeywordSchema = z.string().trim().min(3);

const nonBlankTrimmedStringSchema = z.string().trim().min(1);

export const MuteKeywordScopeSchema = z.enum(["title", "body", "title_and_body"]);

export const MuteKeywordDtoSchema = z.strictObject({
  id: z.string(),
  keyword: nonBlankTrimmedStringSchema,
  scope: MuteKeywordScopeSchema,
  created_at: IsoDateTimeStringSchema,
  updated_at: IsoDateTimeStringSchema,
});

export const MuteKeywordDtoListSchema = z.array(MuteKeywordDtoSchema);

export type MuteKeywordScope = z.output<typeof MuteKeywordScopeSchema>;
export type MuteKeywordDto = z.output<typeof MuteKeywordDtoSchema>;
