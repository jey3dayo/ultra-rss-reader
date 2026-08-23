import type { PlatformKind } from "@/constants/platform";
import type { SidebarHeaderPropsParams } from "../sidebar.types";
import type { SidebarHeaderProps } from "../sidebar-header-view";

export type BuildSidebarHeaderPropsParams = SidebarHeaderPropsParams & {
  hasTauriRuntime: boolean;
  isMobile: boolean;
  /**
   * True while the feed list is refetching after sync invalidation. The native
   * `finished` progress stage means "sync finished", not "list updated": the
   * list is refetched after invalidation and keeps the previous snapshot until
   * new data lands. Keeping the sync button spinning through the refetch is
   * what tells the user their new unread counts are still on the way.
   */
  isFeedListRefetching: boolean;
  platformKind: PlatformKind | null;
  shouldUseDesktopOverlayTitlebar: (params: { platformKind: PlatformKind | null; hasTauriRuntime: boolean }) => boolean;
};

export function buildSidebarHeaderProps({
  t,
  syncProgress,
  handleSync,
  syncTooltipLabel,
  isSyncCoolingDown,
  isSyncDisabled,
  handleAddFeed,
  hasTauriRuntime,
  isMobile,
  isFeedListRefetching,
  platformKind,
  shouldUseDesktopOverlayTitlebar,
}: BuildSidebarHeaderPropsParams): SidebarHeaderProps {
  const useDesktopOverlay = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime,
  });
  const syncStatus =
    syncProgress.active || isFeedListRefetching
      ? "syncing"
      : isSyncDisabled
        ? "disabled"
        : isSyncCoolingDown
          ? "cooldown"
          : "idle";

  return {
    onSync: handleSync,
    onAddFeed: handleAddFeed,
    syncButtonLabel: t("sync_feeds"),
    syncTooltipLabel: syncTooltipLabel ?? undefined,
    syncButtonText: t("sync_short"),
    addFeedButtonLabel: t("add_feed"),
    addFeedButtonText: t("add_short"),
    displayState: {
      layout: isMobile ? "mobile" : "desktop",
      titlebar: useDesktopOverlay ? "desktop-overlay" : "standard",
    },
    syncState: {
      status: syncStatus,
    },
    actionAvailability: {
      addFeed: "available",
    },
  };
}
