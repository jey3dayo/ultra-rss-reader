import { ContextMenu } from "@base-ui/react/context-menu";
import { CONTEXT_MENU_ACTION_IDS } from "./context-menu-action-policy";
import { contextMenuStyles } from "./context-menu-styles";

type AccountContextMenuContentProps = {
  settingsLabel: string;
  onOpenSettings: () => void;
};

export function AccountContextMenuContent({ settingsLabel, onOpenSettings }: AccountContextMenuContentProps) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item
            data-action-id={CONTEXT_MENU_ACTION_IDS.accountOpenSettings}
            className={contextMenuStyles.item}
            onClick={onOpenSettings}
          >
            {settingsLabel}
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
