import { renderHook } from "@testing-library/react";
import { resetTauriRuntimeFlags, setTauriRuntimePresent } from "@tests/helpers/tauri-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSidebarHeaderProps } from "@/components/reader/hooks/sidebar/use-sidebar-header-props";
import i18n from "@/lib/i18n";
import { usePlatformStore } from "@/stores/platform-store";
import { useUiStore } from "@/stores/ui-store";

const t = i18n.getFixedT("en", "sidebar");

describe("useSidebarHeaderProps", () => {
  beforeEach(() => {
    useUiStore.setState({ layoutMode: "wide" });
    usePlatformStore.setState(usePlatformStore.getInitialState());
    resetTauriRuntimeFlags();
  });

  afterEach(() => {
    resetTauriRuntimeFlags();
  });

  it("maps sidebar header labels and handlers", () => {
    const handleSync = vi.fn();
    const handleAddFeed = vi.fn();

    const { result } = renderHook(() =>
      useSidebarHeaderProps({
        t,
        syncProgress: { active: true, kind: "manual" },
        handleSync,
        syncTooltipLabel: "Cooling down",
        isSyncCoolingDown: true,
        isSyncDisabled: true,
        handleAddFeed,
      }),
    );

    expect(result.current).toEqual({
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
    });
  });

  it("does not treat manual account sync as global syncing", () => {
    const { result } = renderHook(() =>
      useSidebarHeaderProps({
        t,
        syncProgress: { active: true, kind: "manual_account" },
        handleSync: vi.fn(),
        syncTooltipLabel: null,
        isSyncCoolingDown: false,
        isSyncDisabled: false,
        handleAddFeed: vi.fn(),
      }),
    );

    expect(result.current.syncState.status).toBe("idle");
    expect(result.current.syncTooltipLabel).toBeUndefined();
  });

  it("derives mobile and desktop overlay runtime props", () => {
    setTauriRuntimePresent();
    useUiStore.setState({ layoutMode: "mobile" });
    usePlatformStore.setState({
      platform: {
        kind: "macos",
        capabilities: {
          supports_reading_list: false,
          supports_background_browser_open: false,
          supports_runtime_window_icon_replacement: true,
          supports_native_browser_navigation: true,
          uses_dev_file_credentials: false,
        },
      },
      loaded: true,
      loadError: false,
      inFlightLoad: null,
    });

    const { result } = renderHook(() =>
      useSidebarHeaderProps({
        t,
        syncProgress: { active: false, kind: null },
        handleSync: vi.fn(),
        syncTooltipLabel: null,
        isSyncCoolingDown: false,
        isSyncDisabled: false,
        handleAddFeed: vi.fn(),
      }),
    );

    expect(result.current.displayState.layout).toBe("mobile");
    expect(result.current.displayState.titlebar).toBe("desktop-overlay");
  });

  it("prioritizes disabled before cooldown when sync is inactive", () => {
    const { result } = renderHook(() =>
      useSidebarHeaderProps({
        t,
        syncProgress: { active: false, kind: null },
        handleSync: vi.fn(),
        syncTooltipLabel: "Cooling down",
        isSyncCoolingDown: true,
        isSyncDisabled: true,
        handleAddFeed: vi.fn(),
      }),
    );

    expect(result.current.syncState.status).toBe("disabled");
  });
});
