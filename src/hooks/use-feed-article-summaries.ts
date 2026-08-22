import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { listFeedArticleSummaries } from "@/api/tauri-commands";
import { queryKeys } from "@/lib/query/query-invalidation";

export function useFeedArticleSummaries(accountId: string | null) {
  const trimmedAccountId = accountId?.trim() ?? null;
  const enabled = !!trimmedAccountId;

  return useQuery({
    queryKey: queryKeys.feedArticleSummaries.subscriptionsIndex(accountId),
    queryFn: () => {
      if (!trimmedAccountId) {
        throw new Error("accountId is required when the query is enabled.");
      }
      return listFeedArticleSummaries(trimmedAccountId).then(Result.unwrap());
    },
    enabled,
  });
}
