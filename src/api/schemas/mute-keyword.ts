import { z } from "zod";

const nonBlankTrimmedStringSchema = z.string().trim().min(1);
const isoDateTimeStringSchema = z.string().datetime({ offset: true });

export const MuteKeywordScopeSchema = z.enum(["title", "body", "title_and_body"]);

export const MuteKeywordDtoSchema = z.object({
  id: z.string(),
  keyword: nonBlankTrimmedStringSchema,
  scope: MuteKeywordScopeSchema,
  created_at: isoDateTimeStringSchema,
  updated_at: isoDateTimeStringSchema,
});

export const MuteKeywordDtoListSchema = z.array(MuteKeywordDtoSchema);

export type MuteKeywordScope = z.output<typeof MuteKeywordScopeSchema>;
export type MuteKeywordDto = z.output<typeof MuteKeywordDtoSchema>;
