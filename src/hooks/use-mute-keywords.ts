import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { createMuteKeyword, deleteMuteKeyword, listMuteKeywords, updateMuteKeyword } from "@/api/tauri-commands";
import { createMutation } from "@/hooks/create-mutation";

export type CreateMuteKeywordMutationInput = {
  keyword: string;
  scope: "title" | "body" | "title_and_body";
};

export type DeleteMuteKeywordMutationInput = {
  muteKeywordId: string;
};

export type UpdateMuteKeywordMutationInput = {
  muteKeywordId: string;
  scope: "title" | "body" | "title_and_body";
};

function invalidateMuteKeywordQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["muteKeywords"] });
  qc.invalidateQueries({ queryKey: ["articles"] });
  qc.invalidateQueries({ queryKey: ["accountArticles"] });
  qc.invalidateQueries({ queryKey: ["articlesByTag"] });
  qc.invalidateQueries({ queryKey: ["search"] });
  qc.invalidateQueries({ queryKey: ["tagArticleCounts"] });
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
