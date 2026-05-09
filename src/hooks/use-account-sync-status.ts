import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { getAccountSyncStatus } from "@/api/tauri-commands";

export const accountSyncStatusQueryKey = (accountId?: string | null) =>
  accountId ? (["account-sync-status", accountId] as const) : (["account-sync-status"] as const);

function requireAccountSyncStatusId(accountId: string | null): string {
  if (!accountId) {
    throw new Error("useAccountSyncStatus queryFn called without accountId");
  }

  return accountId;
}

export function useAccountSyncStatus(accountId: string | null) {
  const normalizedAccountId = accountId?.trim() || null;

  return useQuery({
    queryKey: accountSyncStatusQueryKey(normalizedAccountId),
    queryFn: async () => Result.unwrap(await getAccountSyncStatus(requireAccountSyncStatusId(normalizedAccountId))),
    enabled: Boolean(normalizedAccountId),
  });
}
