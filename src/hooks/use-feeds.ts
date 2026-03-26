import { useQuery } from "@tanstack/react-query";
import { Result } from "@praha/byethrow";
import { listFeeds } from "../api/tauri-commands";

export function useFeeds(accountId: string | null) {
  return useQuery({
    queryKey: ["feeds", accountId],
    queryFn: async () => {
      const result = await listFeeds(accountId as string);
      if (Result.isFailure(result)) throw result.error;
      return result.value;
    },
    enabled: !!accountId,
  });
}
