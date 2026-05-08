import { describe, expect, it, vi } from "vitest";
import { useSidebarHeaderProps } from "@/components/reader/hooks/sidebar/use-sidebar-header-props";
import i18n from "@/lib/i18n";

const t = i18n.getFixedT("en", "sidebar");

describe("useSidebarHeaderProps", () => {
  it("maps sidebar header labels and handlers", () => {
    const handleSync = vi.fn();
    const handleAddFeed = vi.fn();

    const props = useSidebarHeaderProps({
      t,
      syncProgress: { active: true, kind: "manual" },
      handleSync,
      syncTooltipLabel: "Cooling down",
      isSyncCoolingDown: true,
      isSyncDisabled: true,
      handleAddFeed,
    });

    expect(props).toEqual({
      isSyncing: true,
      onSync: handleSync,
      onAddFeed: handleAddFeed,
      syncButtonLabel: t("sync_feeds"),
      syncTooltipLabel: "Cooling down",
      syncButtonText: t("sync_short"),
      addFeedButtonLabel: t("add_feed"),
      addFeedButtonText: t("add_short"),
      isSyncCoolingDown: true,
      isSyncDisabled: true,
    });
  });

  it("does not treat manual account sync as global syncing", () => {
    const props = useSidebarHeaderProps({
      t,
      syncProgress: { active: true, kind: "manual_account" },
      handleSync: vi.fn(),
      syncTooltipLabel: null,
      isSyncCoolingDown: false,
      isSyncDisabled: false,
      handleAddFeed: vi.fn(),
    });

    expect(props.isSyncing).toBe(false);
    expect(props.syncTooltipLabel).toBeUndefined();
  });
});
