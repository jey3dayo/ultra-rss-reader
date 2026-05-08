import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useMarkAllRead, useMarkFeedRead, useMarkFolderRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import {
  buildFeedDisplayPresetOptions,
  displayPresetToTriStateModes,
  type FeedDisplayPresetOption,
  resolveFeedDisplayPreset,
} from "@/lib/article-display";
import { getUnreadArticleIds, resolveArticleListMarkAllReadCount } from "@/lib/article-list";
import { countUnreadFeedsInFolder } from "@/lib/sidebar";
import type { UseArticleListHeaderActionsParams, UseArticleListHeaderActionsResult } from "../../article-list.types";

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
    () =>
      buildFeedDisplayPresetOptions({
        default: t("display_mode_default"),
        standard: t("display_mode_standard"),
        preview: t("display_mode_preview"),
      }),
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
        confirmMarkAllRead({ count: markAllReadCount, onConfirm: doMarkAllRead });
        return;
      }
    }
  }, [confirmMarkAllRead, doMarkAllRead, feedId, markAllReadCount, markFeedRead, markFolderRead, selection]);

  return {
    selectedFeedDisplayPreset,
    displayPresetOptions,
    handleSetDisplayMode,
    handleMarkAllRead,
  };
}
