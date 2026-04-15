import { NavRowButton } from "@/components/shared/nav-row-button";
import { cn } from "@/lib/utils";
import type { SettingsNavViewProps } from "./settings-nav.types";

export type { SettingsNavItem, SettingsNavItemId, SettingsNavViewProps } from "./settings-nav.types";

export function SettingsNavView({ items, onSelectCategory }: SettingsNavViewProps) {
  return (
    <nav className="space-y-1 p-2 pb-4">
      {items.map((item) => (
        <NavRowButton
          key={item.id}
          tone="sidebar"
          selected={item.isActive}
          aria-pressed={item.isActive}
          onClick={() => onSelectCategory(item.id)}
          className={cn(
            "items-center rounded-lg px-3 py-2 text-[14px] font-medium leading-[1.3]",
            item.isActive && "bg-sidebar-accent/82 shadow-none",
          )}
          leading={
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center transition-colors",
                item.isActive
                  ? "text-sidebar-accent-foreground/88"
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
