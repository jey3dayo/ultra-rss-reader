import { describe, expect, it, vi } from "vitest";
import { useAppearanceSettingsViewProps } from "@/components/settings/hooks/use-appearance-settings-view-props";
import i18n from "@/lib/i18n";

const t = i18n.getFixedT("en", "settings");

describe("useAppearanceSettingsViewProps", () => {
  it("maps select preferences and delegates changes", () => {
    const setPref = vi.fn();
    const props = useAppearanceSettingsViewProps({
      t,
      prefs: {
        sidebar_density: "compact",
        theme: "dark",
      },
      setPref,
    });

    expect(props.sections.map((section) => section.id)).toEqual(["theme", "layout", "text", "sidebar", "article-list"]);

    const sidebarSection = props.sections.find((section) => section.id === "sidebar");
    const themeSection = props.sections.find((section) => section.id === "theme");
    const densityControl = sidebarSection?.controls.find((control) => control.id === "sidebar-density");
    const themeControl = themeSection?.controls.find((control) => control.id === "theme");

    expect(densityControl).toEqual(
      expect.objectContaining({
        type: "select",
        name: "sidebar_density",
        value: "compact",
      }),
    );
    expect(themeControl).toEqual(
      expect.objectContaining({
        type: "select",
        name: "theme",
        value: "dark",
      }),
    );

    if (densityControl?.type === "select") {
      densityControl.onChange("spacious");
    }
    if (themeControl?.type === "select") {
      themeControl.onChange("system");
    }

    expect(setPref).toHaveBeenCalledWith("sidebar_density", "spacious");
    expect(setPref).toHaveBeenCalledWith("theme", "system");
  });

  it("maps switch preferences to booleans and string preference writes", () => {
    const setPref = vi.fn();
    const props = useAppearanceSettingsViewProps({
      t,
      prefs: {
        opaque_sidebars: "true",
        display_favicons: "false",
      },
      setPref,
    });

    const sidebarSection = props.sections.find((section) => section.id === "sidebar");
    const opaqueSidebarsControl = sidebarSection?.controls.find((control) => control.id === "opaque-sidebars");
    const displayFaviconsControl = sidebarSection?.controls.find((control) => control.id === "display-favicons");

    expect(opaqueSidebarsControl).toEqual(
      expect.objectContaining({
        type: "switch",
        checked: true,
      }),
    );
    expect(displayFaviconsControl).toEqual(
      expect.objectContaining({
        type: "switch",
        checked: false,
      }),
    );

    if (opaqueSidebarsControl?.type === "switch") {
      opaqueSidebarsControl.onChange(false);
    }
    if (displayFaviconsControl?.type === "switch") {
      displayFaviconsControl.onChange(true);
    }

    expect(setPref).toHaveBeenCalledWith("opaque_sidebars", "false");
    expect(setPref).toHaveBeenCalledWith("display_favicons", "true");
  });
});
