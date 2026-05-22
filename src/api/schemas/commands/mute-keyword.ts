import { z } from "zod";
import { MuteKeywordScopeSchema } from "../mute-keyword";
import { nonBlankTrimmedIdSchema, nonBlankTrimmedStringSchema } from "./shared";

export const createMuteKeywordArgs = z.object({
  keyword: nonBlankTrimmedStringSchema,
  scope: MuteKeywordScopeSchema,
});

export const deleteMuteKeywordArgs = z.object({
  muteKeywordId: nonBlankTrimmedIdSchema,
});

export const updateMuteKeywordArgs = z.object({
  muteKeywordId: nonBlankTrimmedIdSchema,
  scope: MuteKeywordScopeSchema,
});

export const setMuteAutoMarkReadArgs = z.object({
  enabled: z.boolean(),
});
