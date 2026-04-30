import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { getAccountSyncStatus } from "@/api/tauri-commands";

function requireAccountSyncStatusId(accountId: string | null): string {
  if (!accountId) {
    throw new Error("useAccountSyncStatus queryFn called without accountId");
  }

  return accountId;
}

export function useAccountSyncStatus(accountId: string | null) {
  return useQuery({
    queryKey: ["account-sync-status", accountId],
    queryFn: async () => Result.unwrap(await getAccountSyncStatus(requireAccountSyncStatusId(accountId))),
    enabled: Boolean(accountId),
  });
}
