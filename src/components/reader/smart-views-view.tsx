import { SIDEBAR_SELECTED_TARGET_ATTRIBUTE } from "@/lib/reader-focus";
import { cn } from "@/lib/utils";
import type { SidebarSmartViewsProps } from "./sidebar.types";
import { SidebarNavButton } from "./sidebar-nav-button";

const SMART_VIEW_TONE_CLASSNAMES = {
  unread: {
    selected: "bg-[var(--semantic-tone-unread-surface)] text-[var(--semantic-tone-unread-sidebar-foreground)]",
    hover: "hover:text-[var(--semantic-tone-unread-sidebar-foreground)]",
    trailing: "text-[var(--semantic-tone-unread-sidebar-foreground)] opacity-80",
  },
  starred: {
    selected: "bg-[var(--semantic-tone-starred-surface)] text-[var(--semantic-tone-starred-sidebar-foreground)]",
    hover: "hover:text-[var(--semantic-tone-starred-sidebar-foreground)]",
    trailing: "text-[var(--semantic-tone-starred-sidebar-foreground)] opacity-80",
  },
  recent: {
    selected: "bg-surface-2 text-foreground",
    hover: "hover:text-foreground",
    trailing: "text-foreground-soft opacity-80",
  },
} as const;

export function SmartViewsView({ title, views, onSelectSmartView }: SidebarSmartViewsProps) {
  return (
    <div className="space-y-2.5 px-3 py-2">
      {title ? (
        <div className="px-2 text-[0.66rem] font-semibold tracking-[0.12em] text-sidebar-foreground/50 uppercase">
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
          {...(view.isSelected ? { [SIDEBAR_SELECTED_TARGET_ATTRIBUTE]: "true" } : {})}
          size="default"
          trailing={view.showCount ? view.count.toLocaleString() : undefined}
          className={cn(
            "rounded-lg shadow-none",
            SMART_VIEW_TONE_CLASSNAMES[view.kind].hover,
            view.isSelected && SMART_VIEW_TONE_CLASSNAMES[view.kind].selected,
          )}
          trailingClassName={view.isSelected ? SMART_VIEW_TONE_CLASSNAMES[view.kind].trailing : undefined}
        >
          <span className="font-semibold tracking-[-0.01em]">{view.label}</span>
        </SidebarNavButton>
      ))}
    </div>
  );
}
