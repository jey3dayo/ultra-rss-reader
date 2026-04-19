import { ContextMenu } from "@base-ui/react/context-menu";
import { contextMenuStyles } from "./context-menu-styles";

export type SubscriptionsSectionContextMenuViewProps = {
  expandAllFoldersLabel: string;
  collapseAllFoldersLabel: string;
  onExpandAllFolders: () => void;
  onCollapseAllFolders: () => void;
};

export function SubscriptionsSectionContextMenuView({
  expandAllFoldersLabel,
  collapseAllFoldersLabel,
  onExpandAllFolders,
  onCollapseAllFolders,
}: SubscriptionsSectionContextMenuViewProps) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onExpandAllFolders}>
            {expandAllFoldersLabel}
          </ContextMenu.Item>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onCollapseAllFolders}>
            {collapseAllFoldersLabel}
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
