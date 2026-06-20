import { ContextMenu } from "@/design-system";
import { CONTEXT_MENU_ACTION_IDS } from "./context-menu-action-policy";
import { contextMenuStyles } from "./context-menu-styles";
import { OldUnreadContextMenuItems, type OldUnreadDayPreset } from "./old-unread-context-menu-items";

type FolderContextMenuViewProps = {
  markAllReadLabel: string;
  markOldUnreadReadLabel: string;
  oldUnreadDayLabel: (days: OldUnreadDayPreset) => string;
  displayModeLabel: string;
  displayPresetOptions: Array<{ value: string; label: string }>;
  selectedDisplayPreset: string | null;
  hasUnreadArticles?: boolean;
  onMarkAllRead: () => void;
  onMarkOldUnreadRead: (days: OldUnreadDayPreset) => void;
  onSetDisplayPreset: (value: string) => void;
};

export function FolderContextMenuView({
  markAllReadLabel,
  markOldUnreadReadLabel,
  oldUnreadDayLabel,
  displayModeLabel,
  displayPresetOptions,
  selectedDisplayPreset,
  hasUnreadArticles = true,
  onMarkAllRead,
  onMarkOldUnreadRead,
  onSetDisplayPreset,
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
          <div className="px-3 py-1 text-xs font-medium text-foreground-soft">{displayModeLabel}</div>
          {displayPresetOptions.map((option) => (
            <ContextMenu.Item
              key={option.value}
              data-action-id={CONTEXT_MENU_ACTION_IDS.folderSetDisplayPreset}
              data-action-value={option.value}
              className={contextMenuStyles.item}
              onClick={() => onSetDisplayPreset(option.value)}
            >
              <span aria-hidden="true" className="mr-2 inline-flex w-4 justify-center">
                {selectedDisplayPreset === option.value ? "✓" : ""}
              </span>
              {option.label}
            </ContextMenu.Item>
          ))}
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
