import { ContextMenu } from "@base-ui/react/context-menu";
import { contextMenuStyles } from "./context-menu-styles";

export type TagSectionContextMenuViewProps = {
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
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onAddTag}>
            {addTagLabel}
          </ContextMenu.Item>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onManageTags}>
            {manageTagsLabel}
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
