import { CommandGroup, CommandItem, CommandShortcut } from "../ui/command";
import type { CommandPaletteActionGroupsProps, CommandPaletteActionItem } from "./command-palette.types";

function CommandPaletteActionItems({
  actions,
  keyPrefix,
  getCommandItemValue,
  onActionSelect,
}: {
  actions: CommandPaletteActionItem[];
  keyPrefix?: string;
} & Pick<CommandPaletteActionGroupsProps, "getCommandItemValue" | "onActionSelect">) {
  return actions.map((action) => {
    const Icon = action.icon;
    return (
      <CommandItem
        key={keyPrefix ? `${keyPrefix}-${action.id}` : action.id}
        value={getCommandItemValue("action", action.id)}
        onSelect={() => onActionSelect(action.id)}
      >
        <Icon />
        <span>{action.label}</span>
        {action.shortcut ? <CommandShortcut>{action.shortcut}</CommandShortcut> : null}
      </CommandItem>
    );
  });
}

export function CommandPaletteActionGroups({
  recentActions,
  filteredActions,
  showRecentActions,
  showActions,
  recentActionsHeading,
  actionsHeading,
  getCommandItemValue,
  onActionSelect,
}: CommandPaletteActionGroupsProps) {
  return (
    <>
      {showRecentActions && recentActions.length > 0 ? (
        <CommandGroup heading={recentActionsHeading}>
          <CommandPaletteActionItems
            actions={recentActions}
            keyPrefix="recent"
            getCommandItemValue={getCommandItemValue}
            onActionSelect={onActionSelect}
          />
        </CommandGroup>
      ) : null}

      {!showRecentActions && showActions && filteredActions.length > 0 ? (
        <CommandGroup heading={actionsHeading}>
          <CommandPaletteActionItems
            actions={filteredActions}
            getCommandItemValue={getCommandItemValue}
            onActionSelect={onActionSelect}
          />
        </CommandGroup>
      ) : null}
    </>
  );
}
