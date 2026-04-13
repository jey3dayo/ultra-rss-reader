import type { TFunction } from "i18next";
import type { SidebarHeaderView } from "./sidebar-header-view";

type SidebarHeaderProps = Parameters<typeof SidebarHeaderView>[0];

type UseSidebarHeaderPropsParams = {
  t: TFunction<"sidebar">;
  syncProgress: {
    active: boolean;
    kind: string | null;
  };
  handleSync: () => void | Promise<void>;
  handleAddFeed: () => void;
};

export function useSidebarHeaderProps({
  t,
  syncProgress,
  handleSync,
  handleAddFeed,
}: UseSidebarHeaderPropsParams): SidebarHeaderProps {
  return {
    isSyncing: syncProgress.active && syncProgress.kind !== "manual_account",
    onSync: handleSync,
    onAddFeed: handleAddFeed,
    syncButtonLabel: t("sync_feeds"),
    addFeedButtonLabel: t("add_feed"),
  };
}
