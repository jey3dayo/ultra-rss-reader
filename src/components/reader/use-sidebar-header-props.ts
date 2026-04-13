import type { SidebarHeaderProps, SidebarHeaderPropsParams } from "./sidebar.types";

export function useSidebarHeaderProps({
  t,
  syncProgress,
  handleSync,
  handleAddFeed,
}: SidebarHeaderPropsParams): SidebarHeaderProps {
  return {
    isSyncing: syncProgress.active && syncProgress.kind !== "manual_account",
    onSync: handleSync,
    onAddFeed: handleAddFeed,
    syncButtonLabel: t("sync_feeds"),
    addFeedButtonLabel: t("add_feed"),
  };
}
