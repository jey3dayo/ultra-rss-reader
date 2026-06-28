import { useCallback, useMemo } from "react";
import { useMarkAllRead, useMarkFeedRead, useMarkFolderRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { getUnreadArticleIds, resolveArticleListMarkAllReadCount } from "@/lib/articles/article-list";
import { countUnreadFeedsInFolder } from "@/lib/sidebar/sidebar";
import type {
  UseArticleListHeaderActionsParams,
  UseArticleListHeaderActionsResult,
} from "./article-list-controller.types";

export function useArticleListHeaderActions({
  selection,
  feeds,
  feedId,
  selectedFeed,
  filteredArticles,
}: UseArticleListHeaderActionsParams): UseArticleListHeaderActionsResult {
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const markAllRead = useMarkAllRead();
  const markFeedRead = useMarkFeedRead();
  const markFolderRead = useMarkFolderRead();

  const folderUnreadCount = useMemo(() => {
    if (selection.type !== "folder") {
      return 0;
    }

    return countUnreadFeedsInFolder(feeds, selection.folderId);
  }, [feeds, selection]);

  const doMarkAllRead = useCallback(() => {
    const unreadIds = getUnreadArticleIds(filteredArticles);
    markAllRead.mutate(unreadIds);
  }, [filteredArticles, markAllRead]);

  const markAllReadCount = resolveArticleListMarkAllReadCount({
    selection,
    selectedFeedUnreadCount: selectedFeed?.unread_count ?? 0,
    folderUnreadCount,
    filteredArticles,
  });

  const handleMarkAllRead = useCallback(() => {
    switch (selection.type) {
      case "feed":
        if (!feedId) {
          return;
        }
        confirmMarkAllRead({
          count: markAllReadCount,
          onConfirm: () => markFeedRead.mutate(feedId),
        });
        return;
      case "folder":
        confirmMarkAllRead({
          count: markAllReadCount,
          onConfirm: () => markFolderRead.mutate(selection.folderId),
        });
        return;
      case "all":
      case "smart":
      case "tag": {
        confirmMarkAllRead({
          count: markAllReadCount,
          onConfirm: doMarkAllRead,
        });
        return;
      }
    }
  }, [confirmMarkAllRead, doMarkAllRead, feedId, markAllReadCount, markFeedRead, markFolderRead, selection]);

  return {
    handleMarkAllRead,
  };
}
