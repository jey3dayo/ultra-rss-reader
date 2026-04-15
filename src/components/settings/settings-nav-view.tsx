import { NavRowButton } from "@/components/shared/nav-row-button";
import { cn } from "@/lib/utils";
import type { SettingsNavViewProps } from "./settings-nav.types";

export type { SettingsNavItem, SettingsNavItemId, SettingsNavViewProps } from "./settings-nav.types";

export function SettingsNavView({ ariaLabel, items, onSelectCategory }: SettingsNavViewProps) {
  return (
    <nav aria-label={ariaLabel} className="space-y-1 p-2 pb-4">
      {items.map((item) => (
        <NavRowButton
          key={item.id}
          tone="sidebar"
          selected={item.isActive}
          aria-pressed={item.isActive}
          onClick={() => onSelectCategory(item.id)}
          className={cn(
            "relative items-center overflow-hidden rounded-lg px-3 py-2 text-[14px] font-medium leading-[1.3] hover:bg-sidebar-accent/58",
            item.isActive &&
              "bg-[var(--bg-selected)] text-sidebar-accent-foreground shadow-none before:absolute before:inset-y-1.5 before:left-0 before:w-1.5 before:rounded-full before:bg-primary",
          )}
          leading={
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center transition-colors",
                item.isActive
                  ? "text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/62 group-hover:text-sidebar-foreground/80",
              )}
            >
              {item.icon}
            </span>
          }
          title={item.label}
        />
      ))}
    </nav>
  );
}
