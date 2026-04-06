import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SidebarSectionToggle } from "./sidebar-section-toggle";

type SidebarSectionShellProps = {
  title?: string;
  isOpen?: boolean;
  onToggle?: () => void;
  headerClassName?: string;
  bodyClassName?: string;
  children?: ReactNode;
};

export function SidebarSectionShell({
  title,
  isOpen = true,
  onToggle,
  headerClassName,
  bodyClassName,
  children,
}: SidebarSectionShellProps) {
  const hasHeader = title !== undefined;
  const hasBody = children !== undefined && children !== null;

  return (
    <div className="space-y-1">
      {hasHeader ? (
        <div className={cn("px-2 py-2", headerClassName)}>
          {onToggle ? <SidebarSectionToggle label={title} isOpen={isOpen} onToggle={onToggle} /> : null}
          {!onToggle ? <div className="text-sm font-medium text-sidebar-foreground">{title}</div> : null}
        </div>
      ) : null}
      {isOpen && hasBody ? <div className={cn("space-y-1 px-2", bodyClassName)}>{children}</div> : null}
    </div>
  );
}
