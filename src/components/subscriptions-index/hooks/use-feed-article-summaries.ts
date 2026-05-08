import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { listFeedArticleSummaries } from "@/api/tauri-commands";

export function useFeedArticleSummaries(accountId: string | null) {
  return useQuery({
    queryKey: ["feedArticleSummaries", accountId],
    queryFn: () => {
      if (!accountId) {
        throw new Error("accountId is required when the query is enabled.");
      }
      return listFeedArticleSummaries(accountId).then(Result.unwrap());
    },
    enabled: !!accountId,
  });
}
