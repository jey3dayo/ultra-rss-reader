import { ContextMenu } from "@base-ui/react/context-menu";
import { contextMenuStyles } from "./context-menu-styles";

export function FeedContextMenuView({
  openSiteLabel,
  markAllReadLabel,
  unsubscribeLabel,
  editLabel,
  onOpenSite,
  onMarkAllRead,
  onUnsubscribe,
  onEdit,
}: {
  openSiteLabel: string;
  markAllReadLabel: string;
  unsubscribeLabel: string;
  editLabel: string;
  onOpenSite: () => void;
  onMarkAllRead: () => void;
  onUnsubscribe: () => void;
  onEdit: () => void;
}) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onOpenSite}>
            {openSiteLabel}
          </ContextMenu.Item>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onMarkAllRead}>
            {markAllReadLabel}
          </ContextMenu.Item>
          <ContextMenu.Separator className={contextMenuStyles.separator} />
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onUnsubscribe}>
            {unsubscribeLabel}
          </ContextMenu.Item>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onEdit}>
            {editLabel}
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
