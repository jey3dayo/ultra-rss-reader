import { ChevronRight } from "lucide-react";
import { ContextMenu } from "@/design-system/context-menu";
import type { ContextMenuActionId } from "./context-menu-action-policy";
import { contextMenuStyles } from "./context-menu-styles";

const OLD_UNREAD_DAY_PRESETS = [7, 30, 90] as const;

export type OldUnreadDayPreset = (typeof OLD_UNREAD_DAY_PRESETS)[number];

type OldUnreadContextMenuItemsProps = {
  actionId: ContextMenuActionId;
  dayActionId: ContextMenuActionId;
  label: string;
  dayLabel: (days: OldUnreadDayPreset) => string;
  onSelect: (days: OldUnreadDayPreset) => void;
};

export function OldUnreadContextMenuItems({
  actionId,
  dayActionId,
  label,
  dayLabel,
  onSelect,
}: OldUnreadContextMenuItemsProps) {
  return (
    <ContextMenu.SubmenuRoot>
      <ContextMenu.SubmenuTrigger data-action-id={actionId} className={contextMenuStyles.item}>
        <span className="min-w-0 flex-1">{label}</span>
        <ChevronRight aria-hidden="true" className="ml-3 size-4 text-foreground-soft" />
      </ContextMenu.SubmenuTrigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner className={contextMenuStyles.positioner}>
          <ContextMenu.Popup className={contextMenuStyles.popup}>
            {OLD_UNREAD_DAY_PRESETS.map((days) => (
              <ContextMenu.Item
                key={days}
                data-action-id={dayActionId}
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
