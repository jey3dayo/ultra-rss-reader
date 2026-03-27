import { ContextMenu } from "@base-ui/react/context-menu";
import type { FolderDto } from "@/api/tauri-commands";
import { useMarkFolderRead } from "@/hooks/use-articles";
import { usePreferencesStore } from "@/stores/preferences-store";
import { contextMenuStyles } from "./context-menu-styles";

export function FolderContextMenuContent({ folder, folderUnread }: { folder: FolderDto; folderUnread: number }) {
  const askBeforeMarkAll = usePreferencesStore((s) => s.prefs.ask_before_mark_all ?? "true");
  const markFolderRead = useMarkFolderRead();

  const handleMarkAllRead = () => {
    if (folderUnread === 0) return;
    if (askBeforeMarkAll === "true") {
      if (!window.confirm(`Mark ${folderUnread} articles in "${folder.name}" as read?`)) return;
    }
    markFolderRead.mutate(folder.id);
  };

  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={handleMarkAllRead}>
            Mark All as Read
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
