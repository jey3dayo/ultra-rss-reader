import { ContextMenu } from "@base-ui/react/context-menu";
import { contextMenuStyles } from "./context-menu-styles";

export function FeedContextMenuView({
  openSiteLabel,
  markAllReadLabel,
  displayModeLabel,
  displayPresetOptions,
  selectedDisplayPreset,
  unsubscribeLabel,
  editLabel,
  onOpenSite,
  onMarkAllRead,
  onSetDisplayPreset,
  onUnsubscribe,
  onEdit,
}: {
  openSiteLabel: string;
  markAllReadLabel: string;
  displayModeLabel: string;
  displayPresetOptions: Array<{ value: string; label: string }>;
  selectedDisplayPreset: string;
  unsubscribeLabel: string;
  editLabel: string;
  onOpenSite: () => void;
  onMarkAllRead: () => void;
  onSetDisplayPreset: (value: string) => void;
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
          {displayPresetOptions.map((option) => (
            <ContextMenu.Item
              key={option.value}
              className={contextMenuStyles.item}
              onClick={() => onSetDisplayPreset(option.value)}
            >
              <span className="mr-2 inline-flex w-4 justify-center">
                {selectedDisplayPreset === option.value ? "✓" : ""}
              </span>
              {option.label}
            </ContextMenu.Item>
          ))}
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
