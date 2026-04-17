import { NavRowButton } from "@/components/shared/nav-row-button";
import { cn } from "@/lib/utils";
import type { SettingsNavViewProps } from "./settings-nav.types";

export type { SettingsNavItem, SettingsNavItemId, SettingsNavViewProps } from "./settings-nav.types";

export function SettingsNavView({ ariaLabel, items, onSelectCategory }: SettingsNavViewProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className="flex gap-2 overflow-x-auto px-3 py-2.5 sm:block sm:space-y-1 sm:overflow-visible sm:p-2 sm:pb-4"
    >
      {items.map((item) => (
        <NavRowButton
          key={item.id}
          tone="sidebar"
          selected={item.isActive}
          aria-pressed={item.isActive}
          onClick={() => onSelectCategory(item.id)}
          className={cn(
            "relative shrink-0 items-center overflow-hidden rounded-md px-3 py-1.5 text-[13px] font-medium leading-[1.25] sm:w-full",
            item.isActive &&
              "border border-border-strong bg-[var(--bg-selected)] text-sidebar-accent-foreground shadow-none before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-border-strong",
          )}
          leading={
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center transition-colors",
                item.isActive
                  ? "text-[var(--sidebar-selection-muted)]"
                  : "text-sidebar-foreground/44 group-hover:text-sidebar-foreground/64",
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
