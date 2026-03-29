import { useTranslation } from "react-i18next";
import type { FolderDto } from "@/api/tauri-commands";
import { useMarkFolderRead } from "@/hooks/use-articles";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { FolderContextMenuView } from "./folder-context-menu-view";

export function FolderContextMenuContent({ folder, folderUnread }: { folder: FolderDto; folderUnread: number }) {
  const { t } = useTranslation("reader");
  const { t: tc } = useTranslation("common");
  const askBeforeMarkAll = usePreferencesStore((s) => s.prefs.ask_before_mark_all ?? "true");
  const showConfirm = useUiStore((s) => s.showConfirm);
  const markFolderRead = useMarkFolderRead();

  const handleMarkAllRead = () => {
    if (folderUnread === 0) return;
    const doMark = () => markFolderRead.mutate(folder.id);
    if (askBeforeMarkAll === "true") {
      showConfirm(t("confirm_mark_folder_read", { count: folderUnread }), doMark, tc("mark_as_read_action"));
    } else {
      doMark();
    }
  };

  return <FolderContextMenuView markAllReadLabel={t("mark_all_as_read")} onMarkAllRead={handleMarkAllRead} />;
}
