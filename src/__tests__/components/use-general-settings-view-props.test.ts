import { describe, expect, it, vi } from "vitest";
import { useGeneralSettingsViewProps as buildGeneralSettingsViewProps } from "@/components/settings/use-general-settings-view-props";
import i18n from "@/lib/i18n";

const t = i18n.getFixedT("en", "settings");

describe("useGeneralSettingsViewProps", () => {
  it("keeps general settings scoped to app navigation and sync controls", () => {
    const props = buildGeneralSettingsViewProps({
      t,
      prefs: {},
      setPref: vi.fn(),
    });

    expect(props.sections.map((section) => section.id)).toEqual(["app", "navigation", "sync"]);
    expect(props.sections.flatMap((section) => section.controls).map((control) => control.id)).toEqual([
      "language",
      "unread-badge",
      "show-sidebar-unread",
      "show-sidebar-starred",
      "show-sidebar-recent-articles",
      "show-sidebar-tags",
      "startup-folder-expansion",
      "sync-on-startup",
    ]);
  });

  it("writes app startup sync from the general sync section", () => {
    const setPref = vi.fn();
    const props = buildGeneralSettingsViewProps({
      t,
      prefs: {
        sync_on_startup: "true",
      },
      setPref,
    });

    const syncSection = props.sections.find((section) => section.id === "sync");
    const syncControl = syncSection?.controls.find((control) => control.id === "sync-on-startup");

    expect(syncControl).toEqual(
      expect.objectContaining({
        type: "switch",
        checked: true,
      }),
    );

    if (syncControl?.type === "switch") {
      syncControl.onChange(false);
    }

    expect(setPref).toHaveBeenCalledWith("sync_on_startup", "false");
  });
});
