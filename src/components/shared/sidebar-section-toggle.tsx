import { ContextMenu } from "@base-ui/react/context-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SidebarSectionToggleProps } from "./sidebar-section.types";

export function SidebarSectionToggle({
  label,
  isOpen,
  onToggle,
  className,
  panelId,
  contextMenu,
}: SidebarSectionToggleProps) {
  const toggle = (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isOpen}
      aria-controls={panelId}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2 py-1 text-sidebar-foreground transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-surface-1/72 motion-reduce:transition-none",
        className,
      )}
    >
      <span className="text-sm font-medium text-sidebar-foreground">{label}</span>
      <ChevronDown
        className={cn(
          "h-4 w-4 text-foreground-soft transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          !isOpen && "-rotate-90",
        )}
      />
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
