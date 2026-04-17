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
} as const;

export function SmartViewsView({ title, views, onSelectSmartView }: SidebarSmartViewsProps) {
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
          className={cn(
            SMART_VIEW_TONE_CLASSNAMES[view.kind].hover,
            view.isSelected && SMART_VIEW_TONE_CLASSNAMES[view.kind].selected,
          )}
          trailingClassName={view.isSelected ? SMART_VIEW_TONE_CLASSNAMES[view.kind].trailing : undefined}
        >
          <span className="font-medium">{view.label}</span>
        </SidebarNavButton>
      ))}
    </div>
  );
}
