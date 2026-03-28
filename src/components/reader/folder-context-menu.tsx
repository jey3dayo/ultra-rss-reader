import { ContextMenu } from "@base-ui/react/context-menu";
import { useTranslation } from "react-i18next";
import type { FolderDto } from "@/api/tauri-commands";
import { useMarkFolderRead } from "@/hooks/use-articles";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { contextMenuStyles } from "./context-menu-styles";

export function FolderContextMenuContent({ folder, folderUnread }: { folder: FolderDto; folderUnread: number }) {
  const { t } = useTranslation("reader");
  const askBeforeMarkAll = usePreferencesStore((s) => s.prefs.ask_before_mark_all ?? "true");
  const showConfirm = useUiStore((s) => s.showConfirm);
  const markFolderRead = useMarkFolderRead();

  const handleMarkAllRead = () => {
    if (folderUnread === 0) return;
    const doMark = () => markFolderRead.mutate(folder.id);
    if (askBeforeMarkAll === "true") {
      showConfirm(t("confirm_mark_folder_read", { count: folderUnread, name: folder.name }), doMark);
    } else {
      doMark();
    }
  };

  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={handleMarkAllRead}>
            {t("mark_all_as_read")}
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
