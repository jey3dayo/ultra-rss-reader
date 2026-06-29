import { ContextMenu } from "@/design-system/context-menu";
import { CONTEXT_MENU_ACTION_IDS } from "./context-menu-action-policy";
import { contextMenuStyles } from "./context-menu-styles";
import { OldUnreadContextMenuItems, type OldUnreadDayPreset } from "./old-unread-context-menu-items";

type FeedContextMenuViewProps = {
  openSiteLabel: string;
  markAllReadLabel: string;
  markOldUnreadReadLabel: string;
  oldUnreadDayLabel: (days: OldUnreadDayPreset) => string;
  hasUnreadArticles?: boolean;
  unsubscribeLabel: string;
  editLabel: string;
  onOpenSite: () => void;
  onMarkAllRead: () => void;
  onMarkOldUnreadRead: (days: OldUnreadDayPreset) => void;
  onUnsubscribe: () => void;
  onEdit: () => void;
};

export function FeedContextMenuView({
  openSiteLabel,
  markAllReadLabel,
  markOldUnreadReadLabel,
  oldUnreadDayLabel,
  hasUnreadArticles = true,
  unsubscribeLabel,
  editLabel,
  onOpenSite,
  onMarkAllRead,
  onMarkOldUnreadRead,
  onUnsubscribe,
  onEdit,
}: FeedContextMenuViewProps) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner className={contextMenuStyles.positioner}>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item
            data-action-id={CONTEXT_MENU_ACTION_IDS.feedEdit}
            className={contextMenuStyles.item}
            onClick={onEdit}
          >
            {editLabel}
          </ContextMenu.Item>
          <ContextMenu.Item
            data-action-id={CONTEXT_MENU_ACTION_IDS.feedOpenSite}
            className={contextMenuStyles.item}
            onClick={onOpenSite}
          >
            {openSiteLabel}
          </ContextMenu.Item>
          {hasUnreadArticles && (
            <ContextMenu.Item
              data-action-id={CONTEXT_MENU_ACTION_IDS.feedMarkAllRead}
              className={contextMenuStyles.item}
              onClick={onMarkAllRead}
            >
              {markAllReadLabel}
            </ContextMenu.Item>
          )}
          <OldUnreadContextMenuItems
            actionId={CONTEXT_MENU_ACTION_IDS.feedMarkOldUnreadRead}
            dayActionId={CONTEXT_MENU_ACTION_IDS.feedMarkOldUnreadReadDays}
            label={markOldUnreadReadLabel}
            dayLabel={oldUnreadDayLabel}
            onSelect={onMarkOldUnreadRead}
          />
          <ContextMenu.Separator className={contextMenuStyles.separator} />
          <ContextMenu.Item
            data-action-id={CONTEXT_MENU_ACTION_IDS.feedUnsubscribe}
            className={contextMenuStyles.destructiveItem}
            onClick={onUnsubscribe}
          >
            {unsubscribeLabel}
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
