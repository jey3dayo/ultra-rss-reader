import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import type { MuteKeywordScope } from "@/api/schemas";
import {
  createMuteKeyword,
  deleteMuteKeyword,
  listMuteKeywords,
  setMuteAutoMarkRead,
  updateMuteKeyword,
} from "@/api/tauri-commands";
import { createMutation } from "@/hooks/create-mutation";
import { invalidateArticleQueries } from "@/lib/query/query-invalidation";

export type CreateMuteKeywordMutationInput = {
  keyword: string;
  scope: MuteKeywordScope;
};

export type DeleteMuteKeywordMutationInput = {
  muteKeywordId: string;
};

export type UpdateMuteKeywordMutationInput = {
  muteKeywordId: string;
  scope: MuteKeywordScope;
};

export type SetMuteAutoMarkReadMutationInput = {
  enabled: boolean;
};

function invalidateMuteKeywordQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["muteKeywords"] });
  invalidateArticleQueries(qc, { includeTagArticleCounts: true });
}

export function useMuteKeywords() {
  return useQuery({
    queryKey: ["muteKeywords"],
    queryFn: async () => Result.unwrap(await listMuteKeywords()),
  });
}

export const useCreateMuteKeyword = createMutation(
  ({ keyword, scope }: CreateMuteKeywordMutationInput) => createMuteKeyword(keyword, scope),
  invalidateMuteKeywordQueries,
);

export const useDeleteMuteKeyword = createMutation(
  ({ muteKeywordId }: DeleteMuteKeywordMutationInput) => deleteMuteKeyword(muteKeywordId),
  invalidateMuteKeywordQueries,
);

export const useUpdateMuteKeyword = createMutation(
  ({ muteKeywordId, scope }: UpdateMuteKeywordMutationInput) => updateMuteKeyword(muteKeywordId, scope),
  invalidateMuteKeywordQueries,
);

export const useSetMuteAutoMarkRead = createMutation(
  ({ enabled }: SetMuteAutoMarkReadMutationInput) => setMuteAutoMarkRead(enabled),
  invalidateMuteKeywordQueries,
);
