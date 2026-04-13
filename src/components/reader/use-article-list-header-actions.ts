import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { useMarkAllRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import {
  displayPresetToTriStateModes,
  type FeedDisplayPresetOption,
  resolveFeedDisplayPreset,
} from "@/lib/article-display";
import { getUnreadArticleIds } from "@/lib/article-list";

type UseArticleListHeaderActionsParams = {
  feedId: string | null;
  selectedFeed: FeedDto | undefined;
  filteredArticles: ArticleDto[];
};

export type UseArticleListHeaderActionsResult = {
  selectedFeedDisplayPreset: FeedDisplayPresetOption;
  displayPresetOptions: Array<{ value: FeedDisplayPresetOption; label: string }>;
  handleSetDisplayMode: (nextPreset: FeedDisplayPresetOption) => Promise<void>;
  handleMarkAllRead: () => void;
};

export function useArticleListHeaderActions({
  feedId,
  selectedFeed,
  filteredArticles,
}: UseArticleListHeaderActionsParams): UseArticleListHeaderActionsResult {
  const { t } = useTranslation("reader");
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const updateFeedDisplaySettings = useUpdateFeedDisplaySettings();
  const markAllRead = useMarkAllRead();

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

  const doMarkAllRead = useCallback(() => {
    const unreadIds = getUnreadArticleIds(filteredArticles);
    markAllRead.mutate(unreadIds);
  }, [filteredArticles, markAllRead]);

  const handleMarkAllRead = useCallback(() => {
    const unreadIds = getUnreadArticleIds(filteredArticles);
    confirmMarkAllRead({ count: unreadIds.length, onConfirm: doMarkAllRead });
  }, [filteredArticles, confirmMarkAllRead, doMarkAllRead]);

  return {
    selectedFeedDisplayPreset,
    displayPresetOptions,
    handleSetDisplayMode,
    handleMarkAllRead,
  };
}
