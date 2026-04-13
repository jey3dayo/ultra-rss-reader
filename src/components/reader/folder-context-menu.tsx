import { useTranslation } from "react-i18next";
import type { FolderDto } from "@/api/tauri-commands";
import { useMarkFolderRead } from "@/hooks/use-articles";
import { useConfirmMarkAllRead } from "@/hooks/use-confirm-mark-all-read";
import { FolderContextMenuView } from "./folder-context-menu-view";

export type FolderContextMenuContentProps = {
  folder: FolderDto;
  folderUnread: number;
};

export function FolderContextMenuContent({ folder, folderUnread }: FolderContextMenuContentProps) {
  const { t } = useTranslation("reader");
  const confirmMarkAllRead = useConfirmMarkAllRead();
  const markFolderRead = useMarkFolderRead();

  const handleMarkAllRead = () => {
    confirmMarkAllRead({
      count: folderUnread,
      onConfirm: () => markFolderRead.mutate(folder.id),
    });
  };

  return <FolderContextMenuView markAllReadLabel={t("mark_all_as_read")} onMarkAllRead={handleMarkAllRead} />;
}
