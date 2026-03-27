import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { listFeeds } from "../api/tauri-commands";

export function useFeeds(accountId: string | null) {
  return useQuery({
    queryKey: ["feeds", accountId],
    queryFn: () => listFeeds(accountId as string).then(Result.unwrap()),
    enabled: !!accountId,
  });
}
