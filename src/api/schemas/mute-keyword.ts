import { z } from "zod";

export const MuteKeywordScopeSchema = z.enum(["title", "body", "title_and_body"]);

export const MuteKeywordDtoSchema = z.object({
  id: z.string(),
  keyword: z.string(),
  scope: MuteKeywordScopeSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export type MuteKeywordScope = z.infer<typeof MuteKeywordScopeSchema>;
export type MuteKeywordDto = z.infer<typeof MuteKeywordDtoSchema>;
