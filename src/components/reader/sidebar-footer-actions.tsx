import { Moon, Rss, Settings, Sun } from "lucide-react";
import { SidebarFooterActionButton } from "@/components/shared/sidebar-footer-action-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";

type SidebarFooterActionsViewProps = {
  subscriptionsIndexLabel: string;
  subscriptionsIndexShortLabel: string;
  settingsLabel: string;
  themeToggleLabel: string;
  onOpenSubscriptionsIndex: () => void;
  onOpenSettings: () => void;
};

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
  const iconButtonClassName = "size-8 px-0";
  const subscriptionsButtonClassName =
    "mr-auto min-w-0 max-w-[calc(100%-4.5rem)] justify-start gap-1.5 px-2 text-[0.86rem] font-medium";

  return (
    <TooltipProvider>
      <div className="flex h-10 items-center gap-1.5 border-t border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] px-2">
        <SidebarFooterActionButton
          label={subscriptionsIndexLabel}
          tooltipLabel={subscriptionsIndexLabel}
          onClick={onOpenSubscriptionsIndex}
          className={subscriptionsButtonClassName}
        >
          <Rss className="size-4 shrink-0" />
          <span className="min-w-0 truncate">{subscriptionsIndexShortLabel}</span>
        </SidebarFooterActionButton>
        <SidebarFooterActionButton
          label={themeToggleLabel}
          tooltipLabel={themeToggleLabel}
          onClick={() => setPref("theme", isDarkTheme ? "light" : "dark")}
          className={iconButtonClassName}
        >
          {isDarkTheme ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </SidebarFooterActionButton>
        <SidebarFooterActionButton
          label={settingsLabel}
          tooltipLabel={settingsLabel}
          onClick={onOpenSettings}
          className={iconButtonClassName}
        >
          <Settings className="size-4" />
        </SidebarFooterActionButton>
      </div>
    </TooltipProvider>
  );
}
