import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMarkAllRead, useMarkFeedRead, useMarkFolderRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import {
  displayPresetToTriStateModes,
  type FeedDisplayPresetOption,
  resolveFeedDisplayPreset,
} from "@/lib/article-display";
import { getUnreadArticleIds } from "@/lib/article-list";
import type { UseArticleListHeaderActionsParams, UseArticleListHeaderActionsResult } from "./article-list.types";

export function useArticleListHeaderActions({
  selection,
  feeds,
  feedId,
  selectedFeed,
  filteredArticles,
}: UseArticleListHeaderActionsParams): UseArticleListHeaderActionsResult {
  const { t } = useTranslation("reader");
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const updateFeedDisplaySettings = useUpdateFeedDisplaySettings();
  const markAllRead = useMarkAllRead();
  const markFeedRead = useMarkFeedRead();
  const markFolderRead = useMarkFolderRead();

  const selectedFeedDisplayPreset = resolveFeedDisplayPreset(selectedFeed);
  const displayPresetOptions = useMemo<Array<{ value: FeedDisplayPresetOption; label: string }>>(
    () => [
      { value: "default", label: t("display_mode_default") },
      { value: "standard", label: t("display_mode_standard") },
      { value: "preview", label: t("display_mode_preview") },
    ],
    [t],
  );

  const handleSetDisplayMode = useCallback(
    async (nextPreset: FeedDisplayPresetOption) => {
      if (!feedId) return;
      const nextModes = displayPresetToTriStateModes(nextPreset);
      await updateFeedDisplaySettings(feedId, nextModes.readerMode, nextModes.webPreviewMode);
    },
    [feedId, updateFeedDisplaySettings],
  );

  const folderUnreadCount = useMemo(() => {
    if (selection.type !== "folder") {
      return 0;
    }

    return (feeds ?? [])
      .filter((feed) => feed.folder_id === selection.folderId)
      .reduce((sum, feed) => sum + feed.unread_count, 0);
  }, [feeds, selection]);

  const doMarkAllRead = useCallback(() => {
    const unreadIds = getUnreadArticleIds(filteredArticles);
    markAllRead.mutate(unreadIds);
  }, [filteredArticles, markAllRead]);

  const handleMarkAllRead = useCallback(() => {
    switch (selection.type) {
      case "feed":
        if (!feedId) {
          return;
        }
        confirmMarkAllRead({
          count: selectedFeed?.unread_count ?? 0,
          onConfirm: () => markFeedRead.mutate(feedId),
        });
        return;
      case "folder":
        confirmMarkAllRead({
          count: folderUnreadCount,
          onConfirm: () => markFolderRead.mutate(selection.folderId),
        });
        return;
      case "all":
      case "smart":
      case "tag": {
        const unreadIds = getUnreadArticleIds(filteredArticles);
        confirmMarkAllRead({ count: unreadIds.length, onConfirm: doMarkAllRead });
        return;
      }
    }
  }, [
    confirmMarkAllRead,
    doMarkAllRead,
    feedId,
    filteredArticles,
    folderUnreadCount,
    markFeedRead,
    markFolderRead,
    selectedFeed?.unread_count,
    selection,
  ]);

  return {
    selectedFeedDisplayPreset,
    displayPresetOptions,
    handleSetDisplayMode,
    handleMarkAllRead,
  };
}
