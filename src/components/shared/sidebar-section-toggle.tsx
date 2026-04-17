import { ContextMenu } from "@base-ui/react/context-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidebarSectionToggleProps } from "./sidebar-section.types";

export function SidebarSectionToggle({ label, isOpen, onToggle, className, contextMenu }: SidebarSectionToggleProps) {
  const toggle = (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2 py-1 text-sidebar-foreground transition-colors duration-150 hover:bg-surface-1/72",
        className,
      )}
    >
      <span className="text-sm font-medium text-sidebar-foreground">{label}</span>
      <ChevronDown className={cn("h-4 w-4 text-foreground-soft transition-transform", !isOpen && "-rotate-90")} />
    </button>
  );

  if (!contextMenu) {
    return toggle;
  }

  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger render={toggle} />
      {contextMenu}
    </ContextMenu.Root>
  );
}
