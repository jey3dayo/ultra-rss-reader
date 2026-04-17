import { useId } from "react";
import { cn } from "@/lib/utils";
import type { SidebarSectionShellProps } from "./sidebar-section.types";
import { SidebarSectionToggle } from "./sidebar-section-toggle";

export function SidebarSectionShell({
  title,
  isOpen = true,
  onToggle,
  headerClassName,
  bodyClassName,
  children,
  panelId,
}: SidebarSectionShellProps) {
  const hasHeader = title !== undefined;
  const hasBody = children !== undefined && children !== null;
  const fallbackPanelId = useId();
  const resolvedPanelId = panelId ?? `sidebar-section-panel-${fallbackPanelId}`;

  return (
    <div className="space-y-1">
      {hasHeader ? (
        <div className={cn("px-2 py-2", headerClassName)}>
          {onToggle ? (
            <SidebarSectionToggle label={title} isOpen={isOpen} onToggle={onToggle} panelId={resolvedPanelId} />
          ) : null}
          {!onToggle ? <div className="text-sm font-medium text-sidebar-foreground">{title}</div> : null}
        </div>
      ) : null}
      {hasBody ? (
        <div
          id={resolvedPanelId}
          aria-hidden={isOpen ? "false" : "true"}
          className={cn(
            "grid overflow-hidden transition-[grid-template-rows,opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            isOpen ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0",
          )}
        >
          <div
            className={cn(
              "min-h-0 overflow-hidden transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              isOpen ? "translate-y-0" : "-translate-y-2",
            )}
          >
            <div className={cn("space-y-1 px-2", bodyClassName)}>{children}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
