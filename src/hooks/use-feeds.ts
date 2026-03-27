import { useQuery } from "@tanstack/react-query";
import { Result } from "@praha/byethrow";
import { listFeeds } from "../api/tauri-commands";

export function useFeeds(accountId: string | null) {
  return useQuery({
    queryKey: ["feeds", accountId],
    queryFn: () => listFeeds(accountId as string).then(Result.unwrap()),
    enabled: !!accountId,
  });
}
