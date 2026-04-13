import { ContextMenu } from "@base-ui/react/context-menu";
import { useTranslation } from "react-i18next";
import { contextMenuStyles } from "./context-menu-styles";

export type TagContextMenuViewProps = {
  onRename: () => void;
  onDelete: () => void;
};

export function TagContextMenuView({ onRename, onDelete }: TagContextMenuViewProps) {
  const { t } = useTranslation("reader");

  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onRename}>
            {t("edit_ellipsis")}
          </ContextMenu.Item>
          <ContextMenu.Separator className={contextMenuStyles.separator} />
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onDelete}>
            {t("delete_ellipsis")}
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
