import { ContextMenu } from "@/design-system/context-menu";
import type { FolderOrderMode } from "@/lib/sidebar/folder-order";
import { CONTEXT_MENU_ACTION_IDS } from "./context-menu-action-policy";
import { contextMenuStyles } from "./context-menu-styles";
import { OldUnreadContextMenuItems, type OldUnreadDayPreset } from "./old-unread-context-menu-items";

type FolderContextMenuViewProps = {
  markAllReadLabel: string;
  markOldUnreadReadLabel: string;
  oldUnreadDayLabel: (days: OldUnreadDayPreset) => string;
  moveUpLabel: string;
  moveDownLabel: string;
  resetOrderLabel: string;
  hasUnreadArticles?: boolean;
  folderOrderMode: FolderOrderMode;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMarkAllRead: () => void;
  onMarkOldUnreadRead: (days: OldUnreadDayPreset) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onResetOrder: () => void;
};

export function FolderContextMenuView({
  markAllReadLabel,
  markOldUnreadReadLabel,
  oldUnreadDayLabel,
  moveUpLabel,
  moveDownLabel,
  resetOrderLabel,
  hasUnreadArticles = true,
  folderOrderMode,
  canMoveUp,
  canMoveDown,
  onMarkAllRead,
  onMarkOldUnreadRead,
  onMoveUp,
  onMoveDown,
  onResetOrder,
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
          <ContextMenu.Separator className={contextMenuStyles.separator} />
          <ContextMenu.Item
            data-action-id={CONTEXT_MENU_ACTION_IDS.folderMoveUp}
            className={contextMenuStyles.item}
            disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            {moveUpLabel}
          </ContextMenu.Item>
          <ContextMenu.Item
            data-action-id={CONTEXT_MENU_ACTION_IDS.folderMoveDown}
            className={contextMenuStyles.item}
            disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            {moveDownLabel}
          </ContextMenu.Item>
          {folderOrderMode === "manual" ? (
            <ContextMenu.Item
              data-action-id={CONTEXT_MENU_ACTION_IDS.folderResetOrder}
              className={contextMenuStyles.item}
              onClick={onResetOrder}
            >
              {resetOrderLabel}
            </ContextMenu.Item>
          ) : null}
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
