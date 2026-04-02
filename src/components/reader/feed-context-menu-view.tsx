import { ContextMenu } from "@base-ui/react/context-menu";
import { contextMenuStyles } from "./context-menu-styles";

export function FeedContextMenuView({
  openSiteLabel,
  markAllReadLabel,
  displayModeLabel,
  normalModeLabel,
  autoWidescreenModeLabel,
  isAutoWidescreen,
  unsubscribeLabel,
  editLabel,
  onOpenSite,
  onMarkAllRead,
  onSetNormalMode,
  onSetAutoWidescreenMode,
  onUnsubscribe,
  onEdit,
}: {
  openSiteLabel: string;
  markAllReadLabel: string;
  displayModeLabel: string;
  normalModeLabel: string;
  autoWidescreenModeLabel: string;
  isAutoWidescreen: boolean;
  unsubscribeLabel: string;
  editLabel: string;
  onOpenSite: () => void;
  onMarkAllRead: () => void;
  onSetNormalMode: () => void;
  onSetAutoWidescreenMode: () => void;
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
          <div className="px-3 py-1 text-xs font-medium text-muted-foreground">{displayModeLabel}</div>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onSetNormalMode}>
            <span className="mr-2 inline-flex w-4 justify-center">{!isAutoWidescreen ? "✓" : ""}</span>
            {normalModeLabel}
          </ContextMenu.Item>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onSetAutoWidescreenMode}>
            <span className="mr-2 inline-flex w-4 justify-center">{isAutoWidescreen ? "✓" : ""}</span>
            {autoWidescreenModeLabel}
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
