import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SidebarSectionToggleProps = {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
};

export function SidebarSectionToggle({ label, isOpen, onToggle, className }: SidebarSectionToggleProps) {
  return (
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
}
