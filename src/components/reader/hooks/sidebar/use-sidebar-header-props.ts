import { hasTauriRuntime, shouldUseDesktopOverlayTitlebar } from "@/lib/window/window-chrome";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";
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
  const useDesktopOverlay = shouldUseDesktopOverlayTitlebar({
    platformKind,
    hasTauriRuntime: hasTauriRuntime(),
  });
  const syncStatus = syncProgress.active
    ? syncProgress.kind === "manual_account"
      ? "idle"
      : "syncing"
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
  };
}
