import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { countAccountUnreadArticles } from "@/api/tauri-commands";

export function useAccountUnreadCount(accountId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["accountUnreadCount", accountId],
    queryFn: () => countAccountUnreadArticles(accountId as string).then(Result.unwrap()),
    enabled: enabled && !!accountId,
  });
}
