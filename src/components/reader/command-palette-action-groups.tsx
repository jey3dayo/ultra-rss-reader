import { CommandGroup, CommandItem, CommandShortcut } from "@/design-system";
import type { CommandPaletteActionItem, CommandPaletteResultsProps } from "./command-palette.types";

type CommandPaletteActionGroupsProps = Pick<CommandPaletteResultsProps, "getCommandItemValue"> & {
  items: Pick<CommandPaletteResultsProps["items"], "recentActions" | "filteredActions">;
  visibility: Pick<CommandPaletteResultsProps["visibility"], "recentActions" | "actions">;
  headings: Pick<CommandPaletteResultsProps["headings"], "recentActionsHeading" | "actionsHeading">;
  onActionSelect: CommandPaletteResultsProps["handlers"]["onActionSelect"];
};

type CommandPaletteActionItemsProps = Pick<
  CommandPaletteActionGroupsProps,
  "getCommandItemValue" | "onActionSelect"
> & {
  actions: CommandPaletteActionItem[];
  keyPrefix?: string;
};

function CommandPaletteActionItems({
  actions,
  keyPrefix,
  getCommandItemValue,
  onActionSelect,
}: CommandPaletteActionItemsProps) {
  return actions.map((action) => {
    const Icon = action.icon;
    return (
      <CommandItem
        key={keyPrefix ? `${keyPrefix}-${action.id}` : action.id}
        value={getCommandItemValue("action", action.id)}
        onSelect={() => onActionSelect(action.id)}
      >
        <Icon />
        <span className="min-w-0 truncate">{action.label}</span>
        {action.shortcut ? <CommandShortcut>{action.shortcut}</CommandShortcut> : null}
      </CommandItem>
    );
  });
}

export function CommandPaletteActionGroups({
  items,
  visibility,
  headings,
  getCommandItemValue,
  onActionSelect,
}: CommandPaletteActionGroupsProps) {
  return (
    <>
      {visibility.recentActions && items.recentActions.length > 0 ? (
        <CommandGroup heading={headings.recentActionsHeading}>
          <CommandPaletteActionItems
            actions={items.recentActions}
            keyPrefix="recent"
            getCommandItemValue={getCommandItemValue}
            onActionSelect={onActionSelect}
          />
        </CommandGroup>
      ) : null}

      {!visibility.recentActions && visibility.actions && items.filteredActions.length > 0 ? (
        <CommandGroup heading={headings.actionsHeading}>
          <CommandPaletteActionItems
            actions={items.filteredActions}
            getCommandItemValue={getCommandItemValue}
            onActionSelect={onActionSelect}
          />
        </CommandGroup>
      ) : null}
    </>
  );
}
