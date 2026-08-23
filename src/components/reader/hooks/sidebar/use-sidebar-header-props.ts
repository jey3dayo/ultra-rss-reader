import { useIsFetching } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/query-invalidation";
import {
  hasTauriRuntime,
  shouldUseDesktopOverlayTitlebar as shouldUseWindowDesktopOverlayTitlebar,
} from "@/lib/window/window-chrome";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";
import { buildSidebarHeaderProps } from "../../lib/sidebar-header-props";
import type { SidebarHeaderPropsParams } from "../../sidebar.types";
import type { SidebarHeaderProps } from "../../sidebar-header-view";

export function useSidebarHeaderProps({
  t,
  syncProgress,
  handleSync,
  syncTooltipLabel,
  isSyncCoolingDown,
  isSyncDisabled,
  handleAddFeed,
}: SidebarHeaderPropsParams): SidebarHeaderProps {
  const isMobile = useUiStore((state) => state.layoutMode === "mobile");
  const platformKind = usePlatformStore((state) => state.platform.kind);
  // Sync invalidation refetches the feed list; keep the sync button spinning
  // until that refetch settles so the user is not shown stale unread counts
  // with an idle button. See buildSidebarHeaderProps for the contract.
  const isFeedListRefetching = useIsFetching({ queryKey: queryKeys.feeds.root }) > 0;

  return buildSidebarHeaderProps({
    t,
    syncProgress,
    handleSync,
    syncTooltipLabel,
    isSyncCoolingDown,
    isSyncDisabled,
    handleAddFeed,
    hasTauriRuntime: hasTauriRuntime(),
    isMobile,
    isFeedListRefetching,
    platformKind,
    shouldUseDesktopOverlayTitlebar: ({ hasTauriRuntime, platformKind }) =>
      shouldUseWindowDesktopOverlayTitlebar({
        hasTauriRuntime,
        platformKind: platformKind ?? "unknown",
      }),
  });
}
