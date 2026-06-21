import { ContextMenu } from "@/design-system";
import { CONTEXT_MENU_ACTION_IDS } from "./context-menu-action-policy";
import { contextMenuStyles } from "./context-menu-styles";

type TagSectionContextMenuViewProps = {
  addTagLabel: string;
  manageTagsLabel: string;
  onAddTag: () => void;
  onManageTags: () => void;
};

export function TagSectionContextMenuView({
  addTagLabel,
  manageTagsLabel,
  onAddTag,
  onManageTags,
}: TagSectionContextMenuViewProps) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner className={contextMenuStyles.positioner}>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item
            data-action-id={CONTEXT_MENU_ACTION_IDS.tagAdd}
            className={contextMenuStyles.item}
            onClick={onAddTag}
          >
            {addTagLabel}
          </ContextMenu.Item>
          <ContextMenu.Item
            data-action-id={CONTEXT_MENU_ACTION_IDS.tagManage}
            className={contextMenuStyles.item}
            onClick={onManageTags}
          >
            {manageTagsLabel}
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
