import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { useOldUnreadReadAction } from "@/components/reader/hooks/feed-actions/use-old-unread-read-action";
import { useMarkFolderRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { useUiStore } from "@/stores/ui-store";
import { CONTEXT_MENU_ACTION_IDS, createMenuActionHandler } from "./context-menu-action-policy";
import { FolderContextMenuView } from "./folder-context-menu-view";

type FolderContextMenuContentProps = {
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

export function FolderContextMenuContent({ folder, folderUnread }: FolderContextMenuContentProps) {
  const { t } = useTranslation("reader");
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const markFolderRead = useMarkFolderRead();
  const markOldUnreadRead = useOldUnreadReadAction("folder", folder.id);
  const showToast = useUiStore((state) => state.showToast);

  const handleMarkAllRead = useCallback(() => {
    confirmMarkAllRead(
      buildFolderMarkAllReadConfirmation({
        folderId: folder.id,
        unreadCount: folderUnread,
        markFolderRead,
      }),
    );
  }, [confirmMarkAllRead, folder.id, folderUnread, markFolderRead]);

  return (
    <FolderContextMenuView
      markAllReadLabel={t("mark_all_as_read")}
      markOldUnreadReadLabel={t("mark_old_unread_read")}
      oldUnreadDayLabel={(days) => t("old_unread_older_than_days", { count: days })}
      hasUnreadArticles={folderUnread > 0}
      onMarkAllRead={handleMarkAllRead}
      onMarkOldUnreadRead={(days) =>
        createMenuActionHandler(
          CONTEXT_MENU_ACTION_IDS.folderMarkOldUnreadReadDays,
          async () => {
            await markOldUnreadRead(days);
          },
          {
            showToast,
          },
        )()
      }
    />
  );
}
