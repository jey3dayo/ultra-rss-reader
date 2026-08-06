import * as v from "valibot";
import * as s from "@/api/schemas/validation";
import { MuteKeywordScopeSchema } from "../mute-keyword";
import { nonBlankTrimmedIdSchema, nonBlankTrimmedStringSchema } from "./shared";

export const createMuteKeywordArgs = s.object({
  keyword: nonBlankTrimmedStringSchema,
  scope: MuteKeywordScopeSchema,
});

export const deleteMuteKeywordArgs = s.object({
  muteKeywordId: nonBlankTrimmedIdSchema,
});

export const updateMuteKeywordArgs = s.object({
  muteKeywordId: nonBlankTrimmedIdSchema,
  scope: MuteKeywordScopeSchema,
});

export const setMuteAutoMarkReadArgs = s.object({
  enabled: v.boolean(),
});
