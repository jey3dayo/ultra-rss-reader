import { describe, expect, it, vi } from "vitest";
import { buildSidebarHeaderProps } from "@/components/reader/lib/sidebar-header-props";
import i18n from "@/lib/i18n";

const t = i18n.getFixedT("en", "sidebar");

describe("useSidebarHeaderProps", () => {
  it("maps sidebar header labels and handlers", () => {
    const handleSync = vi.fn();
    const handleAddFeed = vi.fn();

    const props = buildSidebarHeaderProps({
      t,
      syncProgress: { active: true, kind: "manual" },
      handleSync,
      syncTooltipLabel: "Cooling down",
      isSyncCoolingDown: true,
      isSyncDisabled: true,
      handleAddFeed,
      hasTauriRuntime: false,
      isMobile: false,
      platformKind: null,
      shouldUseDesktopOverlayTitlebar: () => false,
    });

    expect(props).toEqual({
      onSync: handleSync,
      onAddFeed: handleAddFeed,
      syncButtonLabel: t("sync_feeds"),
      syncTooltipLabel: "Cooling down",
      syncButtonText: t("sync_short"),
      addFeedButtonLabel: t("add_feed"),
      addFeedButtonText: t("add_short"),
      displayState: {
        layout: "desktop",
        titlebar: "standard",
      },
      syncState: {
        status: "syncing",
      },
      actionAvailability: {
        addFeed: "available",
      },
    });
  });

  it("does not treat manual account sync as global syncing", () => {
    const props = buildSidebarHeaderProps({
      t,
      syncProgress: { active: true, kind: "manual_account" },
      handleSync: vi.fn(),
      syncTooltipLabel: null,
      isSyncCoolingDown: false,
      isSyncDisabled: false,
      handleAddFeed: vi.fn(),
      hasTauriRuntime: false,
      isMobile: false,
      platformKind: null,
      shouldUseDesktopOverlayTitlebar: () => false,
    });

    expect(props.syncState.status).toBe("idle");
    expect(props.syncTooltipLabel).toBeUndefined();
  });

  it("derives mobile and desktop overlay runtime props", () => {
    const props = buildSidebarHeaderProps({
      t,
      syncProgress: { active: false, kind: null },
      handleSync: vi.fn(),
      syncTooltipLabel: null,
      isSyncCoolingDown: false,
      isSyncDisabled: false,
      handleAddFeed: vi.fn(),
      hasTauriRuntime: true,
      isMobile: true,
      platformKind: "macos",
      shouldUseDesktopOverlayTitlebar: ({ hasTauriRuntime, platformKind }) => {
        return hasTauriRuntime && platformKind === "macos";
      },
    });

    expect(props.displayState.layout).toBe("mobile");
    expect(props.displayState.titlebar).toBe("desktop-overlay");
  });

  it("prioritizes disabled before cooldown when sync is inactive", () => {
    const props = buildSidebarHeaderProps({
      t,
      syncProgress: { active: false, kind: null },
      handleSync: vi.fn(),
      syncTooltipLabel: "Cooling down",
      isSyncCoolingDown: true,
      isSyncDisabled: true,
      handleAddFeed: vi.fn(),
      hasTauriRuntime: false,
      isMobile: false,
      platformKind: null,
      shouldUseDesktopOverlayTitlebar: () => false,
    });

    expect(props.syncState.status).toBe("disabled");
  });
});
