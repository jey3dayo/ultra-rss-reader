import { Rss, Settings } from "lucide-react";
import { controlChipIconVariants, controlChipVariants } from "@/components/shared/control-chip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SidebarFooterActionsViewProps } from "./sidebar.types";

export function SidebarFooterActions({
  subscriptionsIndexLabel,
  settingsLabel,
  onOpenSubscriptionsIndex,
  onOpenSettings,
}: SidebarFooterActionsViewProps) {
  const footerActionClassName = cn(
    controlChipVariants({ size: "comfortable", interaction: "action" }),
    "h-9 rounded-xl border border-[var(--sidebar-frame-border)] bg-[color-mix(in_srgb,var(--sidebar-frame-solid-surface)_78%,var(--surface-2)_22%)] px-3 text-[0.82rem] font-semibold tracking-[-0.015em] text-foreground/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_-18px_rgba(0,0,0,0.45)] hover:border-[var(--sidebar-divider-strong)] hover:bg-[color-mix(in_srgb,var(--sidebar-frame-solid-surface)_88%,var(--surface-2)_12%)] hover:text-foreground focus-visible:border-[var(--sidebar-divider-strong)] focus-visible:bg-[color-mix(in_srgb,var(--sidebar-frame-solid-surface)_88%,var(--surface-2)_12%)] focus-visible:ring-0 sm:h-8 sm:rounded-md sm:border-0 sm:bg-transparent sm:px-3 sm:text-sm sm:font-medium sm:tracking-normal sm:shadow-none",
  );

  return (
    <div className="flex h-10 items-center justify-center gap-1.5 border-t border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] px-2">
      <Button variant="ghost" size="sm" onClick={onOpenSubscriptionsIndex} className={footerActionClassName}>
        <Rss className={controlChipIconVariants({ size: "comfortable" })} />
        <span>{subscriptionsIndexLabel}</span>
      </Button>
      <Button variant="ghost" size="sm" onClick={onOpenSettings} className={footerActionClassName}>
        <Settings className={controlChipIconVariants({ size: "comfortable" })} />
        <span>{settingsLabel}</span>
      </Button>
    </div>
  );
}
