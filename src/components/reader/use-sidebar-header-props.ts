import type { SidebarHeaderProps, SidebarHeaderPropsParams } from "./sidebar.types";

export function useSidebarHeaderProps({
  t,
  syncProgress,
  handleSync,
  syncTooltipLabel,
  isSyncCoolingDown,
  isSyncDisabled,
  handleAddFeed,
}: SidebarHeaderPropsParams): SidebarHeaderProps {
  return {
    isSyncing: syncProgress.active && syncProgress.kind !== "manual_account",
    onSync: handleSync,
    onAddFeed: handleAddFeed,
    syncButtonLabel: t("sync_feeds"),
    syncTooltipLabel,
    syncButtonText: t("sync_short"),
    addFeedButtonLabel: t("add_feed"),
    addFeedButtonText: t("add_short"),
    isSyncCoolingDown,
    isSyncDisabled,
  };
}
