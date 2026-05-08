import { describe, expect, it, vi } from "vitest";
import { useGeneralSettingsViewProps as buildGeneralSettingsViewProps } from "@/components/settings/hooks/use-general-settings-view-props";
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

  it("maps sidebar visibility and startup folder expansion controls to their preference keys", () => {
    const setPref = vi.fn();
    const props = buildGeneralSettingsViewProps({
      t,
      prefs: {
        show_sidebar_unread: "true",
        show_sidebar_starred: "false",
        show_sidebar_recent_articles: "true",
        show_sidebar_tags: "false",
        startup_folder_expansion: "restore_previous",
      },
      setPref,
    });

    const navigationSection = props.sections.find((section) => section.id === "navigation");
    const controls = navigationSection?.controls ?? [];
    const sidebarControls = [
      ["show-sidebar-unread", "show_sidebar_unread", true],
      ["show-sidebar-starred", "show_sidebar_starred", false],
      ["show-sidebar-recent-articles", "show_sidebar_recent_articles", true],
      ["show-sidebar-tags", "show_sidebar_tags", false],
    ] as const;

    for (const [controlId, preferenceKey, checked] of sidebarControls) {
      const control = controls.find((candidate) => candidate.id === controlId);

      expect(control).toEqual(
        expect.objectContaining({
          id: controlId,
          type: "switch",
          checked,
        }),
      );

      if (control?.type === "switch") {
        control.onChange(!checked);
      }

      expect(setPref).toHaveBeenCalledWith(preferenceKey, String(!checked));
    }

    const startupExpansionControl = controls.find((control) => control.id === "startup-folder-expansion");

    expect(startupExpansionControl).toEqual(
      expect.objectContaining({
        id: "startup-folder-expansion",
        type: "select",
        name: "startup_folder_expansion",
        value: "restore_previous",
        options: [
          expect.objectContaining({ value: "all_collapsed" }),
          expect.objectContaining({ value: "unread_folders" }),
          expect.objectContaining({ value: "restore_previous" }),
        ],
      }),
    );

    if (startupExpansionControl?.type === "select") {
      startupExpansionControl.onChange("unread_folders");
    }

    expect(setPref).toHaveBeenCalledWith("startup_folder_expansion", "unread_folders");
  });
});
