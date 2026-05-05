import { ContextMenu } from "@base-ui/react/context-menu";
import { contextMenuStyles } from "./context-menu-styles";
import { OldUnreadContextMenuItems, type OldUnreadDayPreset } from "./old-unread-context-menu-items";

export type FeedContextMenuViewProps = {
  openSiteLabel: string;
  markAllReadLabel: string;
  markOldUnreadReadLabel: string;
  oldUnreadDayLabel: (days: OldUnreadDayPreset) => string;
  displayModeLabel: string;
  displayPresetOptions: Array<{ value: string; label: string }>;
  selectedDisplayPreset: string;
  unsubscribeLabel: string;
  editLabel: string;
  onOpenSite: () => void;
  onMarkAllRead: () => void;
  onMarkOldUnreadRead: (days: OldUnreadDayPreset) => void;
  onSetDisplayPreset: (value: string) => void;
  onUnsubscribe: () => void;
  onEdit: () => void;
};

export function FeedContextMenuView({
  openSiteLabel,
  markAllReadLabel,
  markOldUnreadReadLabel,
  oldUnreadDayLabel,
  displayModeLabel,
  displayPresetOptions,
  selectedDisplayPreset,
  unsubscribeLabel,
  editLabel,
  onOpenSite,
  onMarkAllRead,
  onMarkOldUnreadRead,
  onSetDisplayPreset,
  onUnsubscribe,
  onEdit,
}: FeedContextMenuViewProps) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onEdit}>
            {editLabel}
          </ContextMenu.Item>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onOpenSite}>
            {openSiteLabel}
          </ContextMenu.Item>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onMarkAllRead}>
            {markAllReadLabel}
          </ContextMenu.Item>
          <OldUnreadContextMenuItems
            label={markOldUnreadReadLabel}
            dayLabel={oldUnreadDayLabel}
            onSelect={onMarkOldUnreadRead}
          />
          <ContextMenu.Separator className={contextMenuStyles.separator} />
          <div className="px-3 py-1 text-xs font-medium text-foreground-soft">{displayModeLabel}</div>
          {displayPresetOptions.map((option) => (
            <ContextMenu.Item
              key={option.value}
              className={contextMenuStyles.item}
              onClick={() => onSetDisplayPreset(option.value)}
            >
              <span aria-hidden="true" className="mr-2 inline-flex w-4 justify-center">
                {selectedDisplayPreset === option.value ? "✓" : ""}
              </span>
              {option.label}
            </ContextMenu.Item>
          ))}
          <ContextMenu.Separator className={contextMenuStyles.separator} />
          <ContextMenu.Item className={contextMenuStyles.destructiveItem} onClick={onUnsubscribe}>
            {unsubscribeLabel}
          </ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
