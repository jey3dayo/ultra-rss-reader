import { ContextMenu } from "@base-ui/react/context-menu";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SidebarSectionToggleProps = {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
  panelId?: string;
  contextMenu?: ReactNode;
};

export const sidebarSectionLabelClassName =
  "text-[0.72rem] font-semibold tracking-[0.12em] text-sidebar-foreground/56 uppercase";

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
        "motion-disclosure-trigger flex w-full items-center justify-between rounded-lg px-1.5 py-1.5 text-[var(--sidebar-foreground-soft-strong)] select-none transition-[background-color,color] duration-150 hover:bg-surface-1/72 hover:text-sidebar-foreground focus-visible:bg-[var(--sidebar-hover-surface)] focus-visible:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-0 motion-reduce:transition-none",
        className,
      )}
    >
      <span className={sidebarSectionLabelClassName}>{label}</span>
      <ChevronDown
        className={cn("motion-disclosure-icon h-3.5 w-3.5 text-sidebar-foreground/54", !isOpen && "-rotate-90")}
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
