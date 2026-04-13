import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { getAccountSyncStatus } from "@/api/tauri-commands";

export function useAccountSyncStatus(accountId: string | null) {
  return useQuery({
    queryKey: ["account-sync-status", accountId],
    queryFn: () => getAccountSyncStatus(accountId ?? "").then(Result.unwrap()),
    enabled: accountId != null,
  });
}
