import { FolderTree, Settings } from "lucide-react";
import { controlChipIconVariants, controlChipVariants } from "@/components/shared/control-chip";
import { Button } from "@/components/ui/button";

type SidebarFooterActionsProps = {
  feedCleanupLabel: string;
  settingsLabel: string;
  onOpenFeedCleanup: () => void;
  onOpenSettings: () => void;
};

export function SidebarFooterActions({
  feedCleanupLabel,
  settingsLabel,
  onOpenFeedCleanup,
  onOpenSettings,
}: SidebarFooterActionsProps) {
  return (
    <div className="flex h-10 items-center justify-center gap-1.5 border-t border-border bg-sidebar px-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={onOpenFeedCleanup}
        className={controlChipVariants({ size: "comfortable", interaction: "action" })}
      >
        <FolderTree className={controlChipIconVariants({ size: "comfortable" })} />
        <span>{feedCleanupLabel}</span>
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
