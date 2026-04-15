import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { SidebarSectionToggleProps } from "./sidebar-section.types";

export function SidebarSectionToggle({ label, isOpen, onToggle, className, renderWrapper }: SidebarSectionToggleProps) {
  const toggle: ReactNode = (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2 py-1 text-sidebar-foreground transition-colors duration-150 hover:bg-sidebar-accent/35",
        className,
      )}
    >
      <span className="text-sm font-medium text-sidebar-foreground">{label}</span>
      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !isOpen && "-rotate-90")} />
    </button>
  );
  return renderWrapper ? renderWrapper(toggle) : toggle;
}
