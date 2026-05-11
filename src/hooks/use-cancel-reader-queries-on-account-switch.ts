import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { queryKeys } from "@/lib/query/query-invalidation";

const ACCOUNT_SWITCH_QUERY_ROOTS = [
  queryKeys.feeds.root,
  queryKeys.folders.root,
  queryKeys.accountArticles.root,
  queryKeys.starredArticles.root,
  queryKeys.recentArticles.root,
  queryKeys.accountUnreadCount.root,
  queryKeys.accountStarredCount.root,
  queryKeys.articlesByTag.root,
  queryKeys.tagArticleCounts.root,
  queryKeys.search.root,
] as const;

export function useCancelReaderQueriesOnAccountSwitch(selectedAccountId: string | null): void {
  const queryClient = useQueryClient();
  const previousAccountIdRef = useRef(selectedAccountId);

  useEffect(() => {
    const previousAccountId = previousAccountIdRef.current;
    previousAccountIdRef.current = selectedAccountId;

    if (previousAccountId === selectedAccountId) {
      return;
    }

    for (const queryKey of ACCOUNT_SWITCH_QUERY_ROOTS) {
      void queryClient.cancelQueries({ queryKey });
    }
  }, [queryClient, selectedAccountId]);
}
