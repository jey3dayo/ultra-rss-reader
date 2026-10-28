import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { useOldUnreadReadAction } from "@/components/reader/hooks/feed-actions/use-old-unread-read-action";
import { useMarkFolderRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import type { FolderOrderMode } from "@/lib/sidebar/folder-order";
import { useUiStore } from "@/stores/ui-store";
import { CONTEXT_MENU_ACTION_IDS, createMenuActionHandler } from "./context-menu-action-policy";
import { FolderContextMenuView } from "./folder-context-menu-view";

type FolderContextMenuContentProps = {
  folder: FolderDto;
  folderUnread: number;
  feeds: FeedDto[];
  folderOrderMode: FolderOrderMode;
  visibleFolderIndex: number;
  visibleFolderCount: number;
  canMoveFolderUp: boolean;
  canMoveFolderDown: boolean;
  onMoveFolderUp: () => void;
  onMoveFolderDown: () => void;
  onResetFolderOrder: () => void;
};

function buildFolderMarkAllReadConfirmation(params: {
  folderId: string;
  unreadCount: number;
  markFolderRead: { mutate: (folderId: string) => void };
}) {
  const { folderId, unreadCount, markFolderRead } = params;

  return {
    count: unreadCount,
    scope: "folder" as const,
    onConfirm: () => markFolderRead.mutate(folderId),
  };
}

export function FolderContextMenuContent({
  folder,
  folderUnread,
  folderOrderMode,
  canMoveFolderUp,
  canMoveFolderDown,
  onMoveFolderUp,
  onMoveFolderDown,
  onResetFolderOrder,
}: FolderContextMenuContentProps) {
  const { t } = useTranslation("reader");
  const { t: sidebarT } = useTranslation("sidebar");
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
      moveUpLabel={sidebarT("folder_move_up")}
      moveDownLabel={sidebarT("folder_move_down")}
      resetOrderLabel={sidebarT("folder_reset_order")}
      hasUnreadArticles={folderUnread > 0}
      folderOrderMode={folderOrderMode}
      canMoveUp={canMoveFolderUp}
      canMoveDown={canMoveFolderDown}
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
      onMoveUp={() => createMenuActionHandler(CONTEXT_MENU_ACTION_IDS.folderMoveUp, onMoveFolderUp, { showToast })()}
      onMoveDown={() =>
        createMenuActionHandler(CONTEXT_MENU_ACTION_IDS.folderMoveDown, onMoveFolderDown, { showToast })()
      }
      onResetOrder={() =>
        createMenuActionHandler(CONTEXT_MENU_ACTION_IDS.folderResetOrder, onResetFolderOrder, { showToast })()
      }
    />
  );
}
