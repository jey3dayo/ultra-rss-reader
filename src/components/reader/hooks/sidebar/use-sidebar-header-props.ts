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
    platformKind,
    shouldUseDesktopOverlayTitlebar: ({ hasTauriRuntime, platformKind }) =>
      shouldUseWindowDesktopOverlayTitlebar({
        hasTauriRuntime,
        platformKind: platformKind ?? "unknown",
      }),
  });
}
