import type { CSSProperties } from "react";
import type { SidebarSmartViewsProps } from "./sidebar.types";
import { SidebarNavButton } from "./sidebar-nav-button";

export function SmartViewsView({ title, views, onSelectSmartView }: SidebarSmartViewsProps) {
  const getToneStyle = (kind: "unread" | "starred") =>
    kind === "unread"
      ? ({
          "--smart-tone": "var(--tone-unread)",
        } as const)
      : ({
          "--smart-tone": "var(--tone-starred)",
        } as const);

  const toneForegroundClassName =
    "text-[color-mix(in_srgb,var(--smart-tone)_var(--tone-foreground-strength),var(--sidebar-selection-foreground))]";
  const toneForegroundHoverClassName =
    "hover:text-[color-mix(in_srgb,var(--smart-tone)_var(--tone-foreground-strength),var(--sidebar-selection-foreground))]";

  const getToneClassName = (isSelected: boolean) =>
    isSelected
      ? `bg-[color-mix(in_srgb,var(--smart-tone)_var(--tone-surface-strength),transparent)] ${toneForegroundClassName} ${toneForegroundHoverClassName}`
      : toneForegroundHoverClassName;

  const getTrailingToneClass = (isSelected: boolean) => {
    if (!isSelected) {
      return "text-[var(--sidebar-foreground-muted-strong)]";
    }

    return `${toneForegroundClassName} opacity-80`;
  };

  return (
    <div className="space-y-2 px-2 py-1.5">
      {title ? (
        <div className="px-2 text-[0.68rem] font-medium tracking-[0.08em] text-[var(--sidebar-foreground-soft-strong)] uppercase">
          {title}
        </div>
      ) : null}
      {views.map((view) => (
        <SidebarNavButton
          key={view.kind}
          onClick={() => onSelectSmartView(view.kind)}
          aria-pressed={view.isSelected}
          selected={view.isSelected}
          selectedIndicatorMode="always"
          size="default"
          trailing={view.showCount ? view.count.toLocaleString() : undefined}
          style={getToneStyle(view.kind) as CSSProperties}
          className={getToneClassName(view.isSelected)}
          trailingClassName={getTrailingToneClass(view.isSelected)}
        >
          <span className="font-medium">{view.label}</span>
        </SidebarNavButton>
      ))}
    </div>
  );
}
