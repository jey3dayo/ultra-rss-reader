import { Select as SelectPrimitive } from "@base-ui/react/select";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/utils";

export type SelectProps = SelectPrimitive.Root.Props<string>;
export type SelectTriggerProps = SelectPrimitive.Trigger.Props;
export type SelectValueProps = SelectPrimitive.Value.Props;
export type SelectPopupProps = SelectPrimitive.Popup.Props;
export type SelectItemProps = SelectPrimitive.Item.Props;
export type SelectGroupProps = SelectPrimitive.Group.Props;
export type SelectGroupLabelProps = SelectPrimitive.GroupLabel.Props;
export type SelectSeparatorProps = React.ComponentProps<"div">;

function Select({ ...props }: SelectProps) {
  return <SelectPrimitive.Root data-slot="select" {...props} />;
}

function SelectTrigger({ className, children, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex w-fit items-center justify-between gap-2 rounded-md border border-border bg-surface-1 px-3 py-2 text-sm whitespace-nowrap text-foreground shadow-elevation-1 transition-[color,background-color,border-color,box-shadow] outline-none hover:bg-surface-2 data-[placeholder]:text-foreground-soft focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-foreground-soft disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon data-slot="select-icon">
        <ChevronDownIcon className="size-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({ ...props }: SelectValueProps) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

function SelectPopup({ className, children, ...props }: SelectPopupProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner sideOffset={8}>
        <SelectPrimitive.Popup
          data-slot="select-popup"
          className={cn(
            "bg-surface-1 text-popover-foreground relative z-50 max-h-64 min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border border-border p-1 shadow-elevation-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className,
          )}
          {...props}
        >
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({ className, children, ...props }: SelectItemProps) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "[&_svg:not([class*='text-'])]:text-foreground-soft relative flex w-full cursor-default items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-highlighted:bg-surface-3 data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    >
      <span className="absolute right-2 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
}

function SelectGroup({ ...props }: SelectGroupProps) {
  return <SelectPrimitive.Group data-slot="select-group" {...props} />;
}

function SelectGroupLabel({ className, ...props }: SelectGroupLabelProps) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-group-label"
      className={cn("text-foreground-soft px-2 py-1.5 text-xs", className)}
      {...props}
    />
  );
}

function SelectSeparator({ className, ...props }: SelectSeparatorProps) {
  return <div data-slot="select-separator" className={cn("bg-border -mx-1 my-1 h-px", className)} {...props} />;
}

export { Select, SelectGroup, SelectGroupLabel, SelectItem, SelectPopup, SelectSeparator, SelectTrigger, SelectValue };
