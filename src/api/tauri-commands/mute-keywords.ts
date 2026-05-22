import {
  createMuteKeywordArgs,
  deleteMuteKeywordArgs,
  MuteKeywordDtoListSchema,
  MuteKeywordDtoSchema,
  type MuteKeywordScope,
  NullResponseSchema,
  setMuteAutoMarkReadArgs,
  updateMuteKeywordArgs,
} from "@/api/schemas";
import { safeInvoke } from "./runtime";

export const listMuteKeywords = () => safeInvoke("list_mute_keywords", { response: MuteKeywordDtoListSchema });

export const createMuteKeyword = (keyword: string, scope: MuteKeywordScope) =>
  safeInvoke(
    "create_mute_keyword",
    { response: MuteKeywordDtoSchema, args: createMuteKeywordArgs },
    { keyword, scope },
  );

export const updateMuteKeyword = (muteKeywordId: string, scope: MuteKeywordScope) =>
  safeInvoke(
    "update_mute_keyword",
    { response: MuteKeywordDtoSchema, args: updateMuteKeywordArgs },
    { muteKeywordId, scope },
  );

export const deleteMuteKeyword = (muteKeywordId: string) =>
  safeInvoke("delete_mute_keyword", { response: NullResponseSchema, args: deleteMuteKeywordArgs }, { muteKeywordId });

export const setMuteAutoMarkRead = (enabled: boolean) =>
  safeInvoke("set_mute_auto_mark_read", { response: NullResponseSchema, args: setMuteAutoMarkReadArgs }, { enabled });
