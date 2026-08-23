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
  selectedAccountId,
  syncProgress,
  handleSync,
  syncTooltipLabel,
  isSyncCoolingDown,
  isSyncDisabled,
  handleAddFeed,
}: SidebarHeaderPropsParams): SidebarHeaderProps {
  const isMobile = useUiStore((state) => state.layoutMode === "mobile");
  const platformKind = usePlatformStore((state) => state.platform.kind);
  // This flag means "the feed list is being refetched", NOT "a sync is
  // running": the spinner is refetch-scoped by design (Issue #102), so it also
  // covers the initial load, an account switch, and feed add/delete/edit.
  // Sync invalidation refetches the feed list, and the button keeps spinning
  // until that refetch settles so the user is never shown stale unread counts
  // next to an idle button. Making it sync-only would need a run-scoped latch
  // plus a grace timer, which reintroduces the invalidation race removed in
  // use-sidebar-sync.ts. See buildSidebarHeaderProps for the contract.
  const isFeedListRefetching =
    useIsFetching({ queryKey: queryKeys.feeds.byAccount(selectedAccountId), exact: true }) > 0;

  return buildSidebarHeaderProps({
    t,
    selectedAccountId,
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
