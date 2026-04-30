import { useTranslation } from "react-i18next";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
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

export function FolderContextMenuContent({ folder, folderUnread, feeds }: FolderContextMenuContentProps) {
  const { t } = useTranslation("reader");
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const markFolderRead = useMarkFolderRead();
  const updateFeedDisplaySettings = useUpdateFeedDisplaySettings();
  const selectedDisplayPreset = resolveFolderDisplayPreset(feeds);
  const displayPresetOptions = buildFeedDisplayPresetOptions({
    default: t("display_mode_default"),
    standard: t("display_mode_standard"),
    preview: t("display_mode_preview"),
  });

  const handleMarkAllRead = () => {
    confirmMarkAllRead({
      count: folderUnread,
      onConfirm: () => markFolderRead.mutate(folder.id),
    });
  };

  const handleSetDisplayPreset = async (value: string) => {
    if (!isFeedDisplayPresetOption(value)) {
      return;
    }

    const nextModes = displayPresetToTriStateModes(value);
    await Promise.all(
      feeds.map((feed) => updateFeedDisplaySettings(feed.id, nextModes.readerMode, nextModes.webPreviewMode)),
    );
  };

  return (
    <FolderContextMenuView
      markAllReadLabel={t("mark_all_as_read")}
      displayModeLabel={t("display_mode")}
      displayPresetOptions={displayPresetOptions}
      selectedDisplayPreset={selectedDisplayPreset}
      onMarkAllRead={handleMarkAllRead}
      onSetDisplayPreset={(value) => {
        void handleSetDisplayPreset(value);
      }}
    />
  );
}
