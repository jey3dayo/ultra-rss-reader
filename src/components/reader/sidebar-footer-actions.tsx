import { Moon, Rss, Settings, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import type { SidebarFooterActionsViewProps } from "./sidebar.types";

export function SidebarFooterActions({
  subscriptionsIndexLabel,
  subscriptionsIndexShortLabel,
  settingsLabel,
  themeToggleLabel,
  onOpenSubscriptionsIndex,
  onOpenSettings,
}: SidebarFooterActionsViewProps) {
  const theme = usePreferencesStore((state) => resolvePreferenceValue(state.prefs, "theme"));
  const setPref = usePreferencesStore((state) => state.setPref);
  const isDarkTheme = theme === "dark";
  const footerButtonClassName = cn(
    "h-8 rounded-md border-0 bg-transparent text-[var(--sidebar-foreground-muted-strong)] shadow-none",
    "hover:bg-[var(--sidebar-hover-surface)] hover:text-[var(--sidebar-selection-foreground)]",
    "focus-visible:border-[var(--sidebar-divider-strong)] focus-visible:bg-[var(--sidebar-hover-surface)] focus-visible:ring-0",
  );
  const iconButtonClassName = cn(footerButtonClassName, "size-8 px-0");
  const subscriptionsButtonClassName = cn(
    footerButtonClassName,
    "mr-auto min-w-0 max-w-[calc(100%-4.5rem)] justify-start gap-1.5 px-2 text-[0.82rem] font-medium",
  );

  return (
    <div className="flex h-10 items-center gap-1.5 border-t border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] px-2">
      <Button
        variant="ghost"
        size="sm"
        aria-label={subscriptionsIndexLabel}
        onClick={onOpenSubscriptionsIndex}
        className={subscriptionsButtonClassName}
      >
        <Rss className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">{subscriptionsIndexShortLabel}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={themeToggleLabel}
        onClick={() => setPref("theme", isDarkTheme ? "light" : "dark")}
        className={iconButtonClassName}
      >
        {isDarkTheme ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={settingsLabel}
        onClick={onOpenSettings}
        className={iconButtonClassName}
      >
        <Settings className="size-3.5" />
      </Button>
    </div>
  );
}
