import { Result } from "@praha/byethrow";
import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
import { getAccountSyncStatus } from "@/api/tauri-commands";

type AccountLike = {
  id: string;
};

export function useAccountSyncStatuses(accounts: readonly AccountLike[] | undefined) {
  const queries = useQueries({
    queries: (accounts ?? []).map((account) => ({
      queryKey: ["account-sync-status", account.id],
      queryFn: async () => Result.unwrap(await getAccountSyncStatus(account.id)),
    })),
  });

  return useMemo(
    () =>
      Object.fromEntries(
        (accounts ?? []).flatMap((account, index) => {
          const data = queries[index]?.data;
          return data ? [[account.id, data]] : [];
        }),
      ),
    [accounts, queries],
  );
}
