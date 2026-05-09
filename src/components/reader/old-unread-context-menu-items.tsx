import { ContextMenu } from "@base-ui/react/context-menu";
import { ChevronRight } from "lucide-react";
import { contextMenuStyles } from "./context-menu-styles";

const OLD_UNREAD_DAY_PRESETS = [7, 30, 90] as const;

export type OldUnreadDayPreset = (typeof OLD_UNREAD_DAY_PRESETS)[number];

type OldUnreadContextMenuItemsProps = {
  actionId: string;
  label: string;
  dayLabel: (days: OldUnreadDayPreset) => string;
  onSelect: (days: OldUnreadDayPreset) => void;
};

export function OldUnreadContextMenuItems({ actionId, label, dayLabel, onSelect }: OldUnreadContextMenuItemsProps) {
  return (
    <ContextMenu.SubmenuRoot>
      <ContextMenu.SubmenuTrigger data-action-id={actionId} className={contextMenuStyles.item}>
        <span className="min-w-0 flex-1">{label}</span>
        <ChevronRight aria-hidden="true" className="ml-3 size-4 text-foreground-soft" />
      </ContextMenu.SubmenuTrigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup className={contextMenuStyles.popup}>
            {OLD_UNREAD_DAY_PRESETS.map((days) => (
              <ContextMenu.Item
                key={days}
                data-action-id={`${actionId}-days`}
                data-action-value={String(days)}
                className={contextMenuStyles.item}
                onClick={() => onSelect(days)}
              >
                {dayLabel(days)}
              </ContextMenu.Item>
            ))}
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.SubmenuRoot>
  );
}
