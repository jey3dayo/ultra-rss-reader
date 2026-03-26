import { useQuery } from "@tanstack/react-query";
import { Result } from "@praha/byethrow";
import { listAccounts } from "../api/tauri-commands";

export function useAccounts() {
  return useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const result = await listAccounts();
      if (Result.isFailure(result)) throw result.error;
      return result.value;
    },
  });
}
