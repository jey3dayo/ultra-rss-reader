import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { getRemoteFeedSyncStatuses } from "@/api/tauri-commands";
import { useAccounts } from "@/hooks/use-accounts";
import { queryKeys } from "@/lib/query/query-invalidation";

export const remoteFeedSyncStatusesQueryKey = (accountId: string | null) =>
  queryKeys.remoteFeedSyncStatuses.byAccount(accountId);

export function useRemoteFeedSyncStatuses(accountId: string | null) {
  const { data: accounts, isPending: accountsPending } = useAccounts();
  const normalizedAccountId = accountId?.trim() || null;
  const account = accounts?.find((candidate) => candidate.id === normalizedAccountId);
  const isFreshRssAccount = account?.kind.toLowerCase() === "freshrss";

  const statusQuery = useQuery({
    queryKey: remoteFeedSyncStatusesQueryKey(isFreshRssAccount ? normalizedAccountId : null),
    queryFn: async () => {
      if (!normalizedAccountId || !isFreshRssAccount) {
        throw new Error("Remote feed sync statuses require a FreshRSS account.");
      }
      return Result.unwrap(await getRemoteFeedSyncStatuses(normalizedAccountId));
    },
    enabled: Boolean(normalizedAccountId && isFreshRssAccount),
  });

  return {
    account,
    accountsPending,
    isFreshRssAccount,
    statusQuery,
  };
}
