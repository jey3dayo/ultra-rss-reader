import { ContextMenu } from "@base-ui/react/context-menu";
import { contextMenuStyles } from "./context-menu-styles";

type SubscriptionsSectionContextMenuViewProps = {
  expandAllFoldersLabel: string;
  collapseAllFoldersLabel: string;
  hasFolders?: boolean;
  onExpandAllFolders: () => void;
  onCollapseAllFolders: () => void;
};

export function SubscriptionsSectionContextMenuView({
  expandAllFoldersLabel,
  collapseAllFoldersLabel,
  hasFolders = true,
  onExpandAllFolders,
  onCollapseAllFolders,
}: SubscriptionsSectionContextMenuViewProps) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          {hasFolders ? (
            <>
              <ContextMenu.Item
                data-action-id="subscriptions-expand-all-folders"
                className={contextMenuStyles.item}
                onClick={onExpandAllFolders}
              >
                {expandAllFoldersLabel}
              </ContextMenu.Item>
              <ContextMenu.Item
                data-action-id="subscriptions-collapse-all-folders"
                className={contextMenuStyles.item}
                onClick={onCollapseAllFolders}
              >
                {collapseAllFoldersLabel}
              </ContextMenu.Item>
            </>
          ) : null}
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
