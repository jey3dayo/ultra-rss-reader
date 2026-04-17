import { FolderTree, Settings } from "lucide-react";
import { controlChipIconVariants, controlChipVariants } from "@/components/shared/control-chip";
import { Button } from "@/components/ui/button";
import type { SidebarFooterActionsViewProps } from "./sidebar.types";

export function SidebarFooterActions({
  subscriptionsIndexLabel,
  settingsLabel,
  onOpenSubscriptionsIndex,
  onOpenSettings,
}: SidebarFooterActionsViewProps) {
  return (
    <div className="flex h-10 items-center justify-center gap-1.5 border-t border-[var(--sidebar-frame-border)] bg-[var(--sidebar-frame-solid-surface)] px-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onOpenSubscriptionsIndex}
        className={controlChipVariants({ size: "comfortable", interaction: "action" })}
      >
        <FolderTree className={controlChipIconVariants({ size: "comfortable" })} />
        <span>{subscriptionsIndexLabel}</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onOpenSettings}
        className={controlChipVariants({ size: "comfortable", interaction: "action" })}
      >
        <Settings className={controlChipIconVariants({ size: "comfortable" })} />
        <span>{settingsLabel}</span>
      </Button>
    </div>
  );
}
