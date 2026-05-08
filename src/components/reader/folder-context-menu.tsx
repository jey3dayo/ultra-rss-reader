import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { useOldUnreadReadAction } from "@/components/reader/hooks/feed-actions/use-old-unread-read-action";
import { useMarkFolderRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import {
  buildFeedDisplayPresetOptions,
  displayPresetToTriStateModes,
  isFeedDisplayPresetOption,
  resolveFolderDisplayPreset,
} from "@/lib/article-display";
import { FolderContextMenuView } from "./folder-context-menu-view";

export type FolderContextMenuContentProps = {
  folder: FolderDto;
  folderUnread: number;
  feeds: FeedDto[];
};

function buildFolderMarkAllReadConfirmation(params: {
  folderId: string;
  unreadCount: number;
  markFolderRead: { mutate: (folderId: string) => void };
}) {
  const { folderId, unreadCount, markFolderRead } = params;

  return {
    count: unreadCount,
    onConfirm: () => markFolderRead.mutate(folderId),
  };
}

export function FolderContextMenuContent({ folder, folderUnread, feeds }: FolderContextMenuContentProps) {
  const { t } = useTranslation("reader");
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const markFolderRead = useMarkFolderRead();
  const markOldUnreadRead = useOldUnreadReadAction("folder", folder.id);
  const updateFeedDisplaySettings = useUpdateFeedDisplaySettings();
  const selectedDisplayPreset = resolveFolderDisplayPreset(feeds);
  const displayPresetOptions = buildFeedDisplayPresetOptions({
    default: t("display_mode_default"),
    standard: t("display_mode_standard"),
    preview: t("display_mode_preview"),
  });

  const handleMarkAllRead = useCallback(() => {
    confirmMarkAllRead(
      buildFolderMarkAllReadConfirmation({
        folderId: folder.id,
        unreadCount: folderUnread,
        markFolderRead,
      }),
    );
  }, [confirmMarkAllRead, folder.id, folderUnread, markFolderRead]);

  const handleSetDisplayPreset = useCallback(
    async (value: string) => {
      if (!isFeedDisplayPresetOption(value)) {
        return;
      }

      const nextModes = displayPresetToTriStateModes(value);
      await Promise.all(
        feeds.map((feed) => updateFeedDisplaySettings(feed.id, nextModes.readerMode, nextModes.webPreviewMode)),
      );
    },
    [feeds, updateFeedDisplaySettings],
  );

  return (
    <FolderContextMenuView
      markAllReadLabel={t("mark_all_as_read")}
      markOldUnreadReadLabel={t("mark_old_unread_read")}
      oldUnreadDayLabel={(days) => t("old_unread_older_than_days", { count: days })}
      displayModeLabel={t("display_mode")}
      displayPresetOptions={displayPresetOptions}
      selectedDisplayPreset={selectedDisplayPreset}
      onMarkAllRead={handleMarkAllRead}
      onMarkOldUnreadRead={(days) => {
        void markOldUnreadRead(days);
      }}
      onSetDisplayPreset={(value) => {
        void handleSetDisplayPreset(value);
      }}
    />
  );
}
