import type { SidebarSmartViewsProps } from "./sidebar.types";
import { SidebarNavButton } from "./sidebar-nav-button";

export function SmartViewsView({ title, views, onSelectSmartView }: SidebarSmartViewsProps) {
  return (
    <div className="space-y-2 px-2 py-1.5">
      {title ? (
        <div className="px-2 text-[0.68rem] font-medium tracking-[0.08em] text-sidebar-foreground/42 uppercase">
          {title}
        </div>
      ) : null}
      {views.map((view) => (
        <SidebarNavButton
          key={view.kind}
          onClick={() => onSelectSmartView(view.kind)}
          aria-pressed={view.isSelected}
          selected={view.isSelected}
          size="default"
          trailing={view.showCount ? view.count.toLocaleString() : undefined}
          trailingClassName={
            view.isSelected ? "text-sidebar-accent-foreground/88" : "text-sidebar-foreground/68 font-medium"
          }
        >
          <span className="font-medium">{view.label}</span>
        </SidebarNavButton>
      ))}
    </div>
  );
}
