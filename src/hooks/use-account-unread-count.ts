import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { countAccountUnreadArticles } from "@/api/tauri-commands";

export function useAccountUnreadCount(accountId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["accountUnreadCount", accountId],
    queryFn: () => {
      if (!accountId) {
        throw new Error("accountId is required");
      }
      return countAccountUnreadArticles(accountId).then(Result.unwrap());
    },
    enabled: enabled && !!accountId,
  });
}
