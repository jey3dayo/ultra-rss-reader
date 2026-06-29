import { ContextMenu } from "@/design-system/context-menu";
import { CONTEXT_MENU_ACTION_IDS } from "./context-menu-action-policy";
import { contextMenuStyles } from "./context-menu-styles";
import { OldUnreadContextMenuItems, type OldUnreadDayPreset } from "./old-unread-context-menu-items";

type FolderContextMenuViewProps = {
  markAllReadLabel: string;
  markOldUnreadReadLabel: string;
  oldUnreadDayLabel: (days: OldUnreadDayPreset) => string;
  hasUnreadArticles?: boolean;
  onMarkAllRead: () => void;
  onMarkOldUnreadRead: (days: OldUnreadDayPreset) => void;
};

export function FolderContextMenuView({
  markAllReadLabel,
  markOldUnreadReadLabel,
  oldUnreadDayLabel,
  hasUnreadArticles = true,
  onMarkAllRead,
  onMarkOldUnreadRead,
}: FolderContextMenuViewProps) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner className={contextMenuStyles.positioner}>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          {hasUnreadArticles && (
            <ContextMenu.Item
              data-action-id={CONTEXT_MENU_ACTION_IDS.folderMarkAllRead}
              className={contextMenuStyles.item}
              onClick={onMarkAllRead}
            >
              {markAllReadLabel}
            </ContextMenu.Item>
          )}
          <OldUnreadContextMenuItems
            actionId={CONTEXT_MENU_ACTION_IDS.folderMarkOldUnreadRead}
            dayActionId={CONTEXT_MENU_ACTION_IDS.folderMarkOldUnreadReadDays}
            label={markOldUnreadReadLabel}
            dayLabel={oldUnreadDayLabel}
            onSelect={onMarkOldUnreadRead}
          />
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
