import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-invalidation";
import { listAccounts } from "../api/tauri-commands";

export function useAccounts() {
  return useQuery({
    queryKey: queryKeys.accounts.root,
    queryFn: () => listAccounts().then(Result.unwrap()),
  });
}
