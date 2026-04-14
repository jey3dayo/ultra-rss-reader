import { cn } from "@/lib/utils";
import type { SettingsNavViewProps } from "./settings-nav.types";

export type { SettingsNavItem, SettingsNavItemId, SettingsNavViewProps } from "./settings-nav.types";

export function SettingsNavView({ items, onSelectCategory }: SettingsNavViewProps) {
  return (
    <nav className="space-y-1 p-2 pb-4">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          onClick={() => onSelectCategory(item.id)}
          className={cn(
            "group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[14px] font-medium leading-[1.3] transition-colors",
            item.isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/88 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          )}
        >
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
          {item.label}
        </button>
      ))}
    </nav>
  );
}
