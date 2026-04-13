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
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            item.isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent/50",
          )}
        >
          <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
