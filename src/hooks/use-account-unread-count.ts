import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import { countAccountUnreadArticles } from "@/api/tauri-commands";

export function useAccountUnreadCount(accountId: string | null, enabled: boolean) {
  const normalizedAccountId = accountId?.trim() || null;

  return useQuery({
    queryKey: ["accountUnreadCount", normalizedAccountId],
    queryFn: () => {
      if (!normalizedAccountId) {
        throw new Error("accountId is required");
      }
      return countAccountUnreadArticles(normalizedAccountId).then(Result.unwrap());
    },
    enabled: enabled && normalizedAccountId !== null,
  });
}
