import { Result } from "@praha/byethrow";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import type { AccountSyncStatusDto } from "@/api/schemas";
import { getAccountSyncStatus } from "@/api/tauri-commands";
import { accountSyncStatusQueryKey } from "@/hooks/use-account-sync-status";

export function useAccountSyncStatuses<T extends { id: string }>(accounts: readonly T[] | undefined) {
  const accountIds = useMemo(
    () => Array.from(new Set((accounts ?? []).map((account) => account.id.trim()).filter(Boolean))),
    [accounts],
  );
  const queries = useQueries({
    queries: accountIds.map((accountId) => ({
      queryKey: accountSyncStatusQueryKey(accountId),
      queryFn: async () => Result.unwrap(await getAccountSyncStatus(accountId)),
    })),
  });

  return useMemo(() => {
    const statusesByAccountId: Record<string, AccountSyncStatusDto> = {};

    accountIds.forEach((accountId, index) => {
      const data = queries[index]?.data;
      if (data) {
        statusesByAccountId[accountId] = data;
      }
    });

    return statusesByAccountId;
  }, [accountIds, queries]);
}
