import { ContextMenu } from "@base-ui/react/context-menu";
import { contextMenuStyles } from "./context-menu-styles";

export type FolderContextMenuViewProps = {
  markAllReadLabel: string;
  displayModeLabel: string;
  displayPresetOptions: Array<{ value: string; label: string }>;
  selectedDisplayPreset: string | null;
  onMarkAllRead: () => void;
  onSetDisplayPreset: (value: string) => void;
};

export function FolderContextMenuView({
  markAllReadLabel,
  displayModeLabel,
  displayPresetOptions,
  selectedDisplayPreset,
  onMarkAllRead,
  onSetDisplayPreset,
}: FolderContextMenuViewProps) {
  return (
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup className={contextMenuStyles.popup}>
          <ContextMenu.Item className={contextMenuStyles.item} onClick={onMarkAllRead}>
            {markAllReadLabel}
          </ContextMenu.Item>
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
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  );
}
