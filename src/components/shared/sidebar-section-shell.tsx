import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { SidebarSectionToggle } from "./sidebar-section-toggle";

type SidebarSectionShellProps = {
  title?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  contextMenu?: ReactNode;
  headerClassName?: string;
  bodyClassName?: string;
  children?: ReactNode;
  panelId?: string;
};

export function SidebarSectionShell({
  title,
  isOpen = true,
  onToggle,
  contextMenu,
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
    <div className="space-y-1.5">
      {hasHeader ? (
        <div className={cn("px-3 pt-3 pb-1.5", headerClassName)}>
          {onToggle ? (
            <SidebarSectionToggle
              label={title}
              isOpen={isOpen}
              onToggle={onToggle}
              panelId={resolvedPanelId}
              contextMenu={contextMenu}
            />
          ) : null}
          {!onToggle ? (
            <div className="px-1 text-[0.72rem] font-medium tracking-[0.12em] text-[var(--sidebar-foreground-soft-strong)] uppercase">
              {title}
            </div>
          ) : null}
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
            <div className={cn("space-y-1.5 px-3", bodyClassName)}>{children}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
