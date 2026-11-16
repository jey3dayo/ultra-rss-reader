import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMarkFeedRead, useMarkFolderRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { canMarkArticleListSelectionRead, resolveArticleListMarkAllReadCount } from "@/lib/articles/article-list";
import { countUnreadFeedsInFolder } from "@/lib/sidebar/sidebar";
import { useUiStore } from "@/stores/ui-store";
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
  const { t } = useTranslation("reader");
  const showToast = useUiStore((s) => s.showToast);
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const markFeedRead = useMarkFeedRead();
  const markFolderRead = useMarkFolderRead();

  const folderUnreadCount = useMemo(() => {
    if (selection.type !== "folder") {
      return 0;
    }

    return countUnreadFeedsInFolder(feeds, selection.folderId);
  }, [feeds, selection]);

  const markAllReadCount = resolveArticleListMarkAllReadCount({
    selection,
    selectedFeedUnreadCount: selectedFeed?.unread_count ?? 0,
    folderUnreadCount,
    filteredArticles,
  });
  const markAllReadDisabled = !canMarkArticleListSelectionRead(selection);

  const handleMarkAllRead = useCallback(() => {
    if (markAllReadDisabled) {
      showToast(t("mark_all_read_unavailable_in_view"));
      return;
    }

    switch (selection.type) {
      case "feed":
        if (!feedId) {
          return;
        }
        confirmMarkAllRead({
          count: markAllReadCount,
          scope: "feed",
          onConfirm: () => markFeedRead.mutate(feedId),
        });
        return;
      case "folder":
        confirmMarkAllRead({
          count: markAllReadCount,
          scope: "folder",
          onConfirm: () => markFolderRead.mutate(selection.folderId),
        });
        return;
    }
  }, [
    confirmMarkAllRead,
    feedId,
    markAllReadCount,
    markAllReadDisabled,
    markFeedRead,
    markFolderRead,
    selection,
    showToast,
    t,
  ]);

  return {
    handleMarkAllRead,
    markAllReadDisabled,
  };
}
