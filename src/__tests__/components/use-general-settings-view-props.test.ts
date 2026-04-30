import { describe, expect, it, vi } from "vitest";
import { useGeneralSettingsViewProps as buildGeneralSettingsViewProps } from "@/components/settings/use-general-settings-view-props";
import i18n from "@/lib/i18n";

const t = i18n.getFixedT("en", "settings");

describe("useGeneralSettingsViewProps", () => {
  it("omits background browser controls on unsupported platforms", () => {
    const props = buildGeneralSettingsViewProps({
      t,
      prefs: { open_links: "default_browser" },
      setPref: vi.fn(),
      platformKind: "linux",
      supportsBackgroundBrowserOpen: false,
    });

    const browserSection = props.sections.find((section) => section.id === "browser");

    expect(browserSection?.note).toBeUndefined();
    expect(browserSection?.controls.map((control) => control.id)).toEqual(["open-links"]);
  });

  it("enables background browser controls only for default browser links", () => {
    const setPref = vi.fn();
    const props = buildGeneralSettingsViewProps({
      t,
      prefs: {
        open_links: "default_browser",
        open_links_background: "true",
      },
      setPref,
      platformKind: "macos",
      supportsBackgroundBrowserOpen: true,
    });

    const browserSection = props.sections.find((section) => section.id === "browser");
    const backgroundControl = browserSection?.controls.find((control) => control.id === "open-links-background");

    expect(browserSection?.note).toBe(
      "Please note that some third-party browsers do not support opening links in the background.",
    );
    expect(backgroundControl).toEqual(
      expect.objectContaining({
        type: "switch",
        checked: true,
        disabled: false,
      }),
    );

    if (backgroundControl?.type === "switch") {
      backgroundControl.onChange(false);
    }

    expect(setPref).toHaveBeenCalledWith("open_links_background", "false");
  });

  it("uses the platform shortcut modifier in cmd-click browser copy", () => {
    const props = buildGeneralSettingsViewProps({
      t,
      prefs: { cmd_click_browser: "true" },
      setPref: vi.fn(),
      platformKind: "windows",
      supportsBackgroundBrowserOpen: false,
    });

    const articleListSection = props.sections.find((section) => section.id === "article-list");
    const cmdClickControl = articleListSection?.controls.find((control) => control.id === "cmd-click-browser");

    expect(cmdClickControl).toEqual(
      expect.objectContaining({
        type: "switch",
        label: "Ctrl-click opens in-app browser",
        checked: true,
      }),
    );
  });
});
