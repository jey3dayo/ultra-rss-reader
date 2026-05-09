import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { countAccountUnreadArticles } from "@/api/tauri-commands";
import { normalizeQueryAccountId, queryKeys } from "@/lib/query/query-invalidation";

const ACCOUNT_UNREAD_COUNT_ACCOUNT_ID_REQUIRED = "Account unread count requires a non-empty account id.";

export function useAccountUnreadCount(accountId: string | null, enabled: boolean) {
  const normalizedAccountId = normalizeQueryAccountId(accountId);

  return useQuery({
    queryKey: queryKeys.accountUnreadCount.byAccount(normalizedAccountId),
    queryFn: () => {
      if (!normalizedAccountId) {
        throw new Error(ACCOUNT_UNREAD_COUNT_ACCOUNT_ID_REQUIRED);
      }
      return countAccountUnreadArticles(normalizedAccountId).then(Result.unwrap());
    },
    enabled: enabled && normalizedAccountId !== null,
  });
}
