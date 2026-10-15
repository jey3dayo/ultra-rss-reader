import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { listFeedArticleSummaries } from "@/api/tauri-commands";
import { queryKeys } from "@/lib/query/query-invalidation";
import { requireEnabledQueryValue } from "@/lib/require-enabled-query-value";

export function useFeedArticleSummaries(accountId: string | null) {
  const trimmedAccountId = accountId?.trim() ?? null;
  const enabled = !!trimmedAccountId;

  return useQuery({
    queryKey: queryKeys.feedArticleSummaries.subscriptionsIndex(accountId),
    queryFn: () =>
      listFeedArticleSummaries(requireEnabledQueryValue(trimmedAccountId, "accountId")).then(Result.unwrap()),
    enabled,
  });
}
