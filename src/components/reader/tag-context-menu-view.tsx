import { ContextMenu } from "@base-ui/react/context-menu";
import { useTranslation } from "react-i18next";
import { CONTEXT_MENU_ACTION_IDS } from "./context-menu-action-policy";
import { contextMenuStyles } from "./context-menu-styles";

type TagContextMenuViewProps = {
  onRename: () => void;
  onDelete: () => void;
};

export function TagContextMenuView({ onRename, onDelete }: TagContextMenuViewProps) {
  const { t } = useTranslation("reader");

  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item
            data-action-id={CONTEXT_MENU_ACTION_IDS.tagEdit}
            className={contextMenuStyles.item}
            onClick={onRename}
          >
            {t("edit_ellipsis")}
          </ContextMenu.Item>
          <ContextMenu.Separator className={contextMenuStyles.separator} />
          <ContextMenu.Item
            data-action-id={CONTEXT_MENU_ACTION_IDS.tagDelete}
            className={contextMenuStyles.destructiveItem}
            onClick={onDelete}
          >
            {t("delete_ellipsis")}
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
