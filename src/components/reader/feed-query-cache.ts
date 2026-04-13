import type { QueryClient } from "@tanstack/react-query";

type InvalidateFeedQueriesOptions = {
  includeFeeds?: boolean;
  includeFolders?: boolean;
  includeAccountUnreadCount?: boolean;
};

export function invalidateFeedQueries(
  queryClient: QueryClient,
  { includeFeeds = true, includeFolders = true, includeAccountUnreadCount = false }: InvalidateFeedQueriesOptions = {},
) {
  if (includeFeeds) {
    void queryClient.invalidateQueries({ queryKey: ["feeds"] });
  }

  if (includeFolders) {
    void queryClient.invalidateQueries({ queryKey: ["folders"] });
  }

  if (includeAccountUnreadCount) {
    void queryClient.invalidateQueries({ queryKey: ["accountUnreadCount"] });
  }
}
