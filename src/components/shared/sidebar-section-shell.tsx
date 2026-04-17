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
          data-state={isOpen ? "open" : "closed"}
          aria-hidden={isOpen ? "false" : "true"}
          className="motion-disclosure-panel"
        >
          <div className="motion-disclosure-body">
            <div className={cn("space-y-1 px-2", bodyClassName)}>{children}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
