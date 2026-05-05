import { ContextMenu } from "@base-ui/react/context-menu";
import { contextMenuStyles } from "./context-menu-styles";

export type AccountContextMenuContentProps = {
  settingsLabel: string;
  onOpenSettings: () => void;
};

export function AccountContextMenuContent({ settingsLabel, onOpenSettings }: AccountContextMenuContentProps) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onOpenSettings}>
            {settingsLabel}
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
