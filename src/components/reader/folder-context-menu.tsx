import { useTranslation } from "react-i18next";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { useMarkFolderRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { useUpdateFeedDisplaySettings } from "@/hooks/use-update-feed-display-mode";
import {
  displayPresetToTriStateModes,
  feedModesToDisplayPresetOption,
  resolveFeedDisplayOverrides,
} from "@/lib/article-display";
import { FolderContextMenuView } from "./folder-context-menu-view";

export type FolderContextMenuContentProps = {
  folder: FolderDto;
  folderUnread: number;
  feeds: FeedDto[];
};

function resolveFolderDisplayPreset(feeds: FeedDto[]): "default" | "standard" | "preview" | null {
  if (feeds.length === 0) {
    return "default";
  }

  const [firstFeed, ...restFeeds] = feeds;
  const firstPreset = feedModesToDisplayPresetOption(
    resolveFeedDisplayOverrides(firstFeed).readerMode,
    resolveFeedDisplayOverrides(firstFeed).webPreviewMode,
  );

  return restFeeds.every((feed) => {
    const preset = feedModesToDisplayPresetOption(
      resolveFeedDisplayOverrides(feed).readerMode,
      resolveFeedDisplayOverrides(feed).webPreviewMode,
    );
    return preset === firstPreset;
  })
    ? firstPreset
    : null;
}

export function FolderContextMenuContent({ folder, folderUnread, feeds }: FolderContextMenuContentProps) {
  const { t } = useTranslation("reader");
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const markFolderRead = useMarkFolderRead();
  const updateFeedDisplaySettings = useUpdateFeedDisplaySettings();
  const selectedDisplayPreset = resolveFolderDisplayPreset(feeds);
  const displayPresetOptions = [
    { value: "default", label: t("display_mode_default") },
    { value: "standard", label: t("display_mode_standard") },
    { value: "preview", label: t("display_mode_preview") },
  ];

  const handleMarkAllRead = () => {
    confirmMarkAllRead({
      count: folderUnread,
      onConfirm: () => markFolderRead.mutate(folder.id),
    });
  };

  const handleSetDisplayPreset = async (value: string) => {
    const nextModes = displayPresetToTriStateModes(value as "default" | "standard" | "preview");
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
