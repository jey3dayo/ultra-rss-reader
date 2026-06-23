import { describe, expect, it, vi } from "vitest";
import { buildReadingSettingsViewProps } from "@/components/settings/lib/reading-settings-view-model";
import type { ReadingSettingsViewProps } from "@/components/settings/reading-settings-view";
import type { SettingsPageControl } from "@/components/settings/settings-page.types";
import { DEV_SCENARIO_ID } from "@/dev/scenario-ids";
import i18n from "@/lib/i18n";

type SettingsPageActionControl = Extract<SettingsPageControl, { type: "action" }>;

const t = i18n.getFixedT("en", "settings");

function getControl(props: ReadingSettingsViewProps, id: string): SettingsPageControl {
  const control = props.sections.flatMap((section) => section.controls).find((item) => item.id === id);

  if (!control) {
    throw new Error(`Missing reading settings control: ${id}`);
  }

  return control;
}

function getSelectControl(props: ReadingSettingsViewProps, id: string) {
  const control = getControl(props, id);

  if (control.type !== "select") {
    throw new Error(`Expected select control: ${id}`);
  }

  return control;
}

function getSwitchControl(props: ReadingSettingsViewProps, id: string) {
  const control = getControl(props, id);

  if (control.type !== "switch") {
    throw new Error(`Expected switch control: ${id}`);
  }

  return control;
}

function getActionControl(props: ReadingSettingsViewProps, id: string): SettingsPageActionControl {
  const control = getControl(props, id);

  if (control.type !== "action") {
    throw new Error(`Expected action control: ${id}`);
  }

  return control;
}

function buildProps(
  overrides: Partial<Parameters<typeof buildReadingSettingsViewProps>[0]> = {},
): ReadingSettingsViewProps {
  return buildReadingSettingsViewProps({
    t,
    prefs: {},
    setPref: vi.fn(),
    clearHistory: {
      isPending: false,
      mutate: vi.fn(),
    },
    devIntent: null,
    platformKind: "macos",
    selectedAccountId: null,
    showConfirm: vi.fn(),
    showToast: vi.fn(),
    supportsBackgroundBrowserOpen: true,
    ...overrides,
  });
}

describe("buildReadingSettingsViewProps", () => {
  it("maps display preset and ignores invalid preset writes", () => {
    const setPref = vi.fn();
    const props = buildProps({
      prefs: {
        reader_mode_default: "true",
        web_preview_mode_default: "true",
      },
      setPref,
    });

    const displayPreset = getSelectControl(props, "display-preset");
    const originalArticleSection = props.sections.find((section) => section.id === "original-article");

    expect(displayPreset).toEqual(
      expect.objectContaining({
        name: "display_preset",
        label: t("reading.default_display_mode"),
        value: "preview",
      }),
    );
    expect(originalArticleSection?.heading).toBe(t("reading.original_article_and_web_preview"));
    expect(originalArticleSection?.controls.map((control) => control.id)).toContain("display-preset");
    expect(displayPreset).not.toHaveProperty("open");

    displayPreset.onChange("invalid");
    expect(setPref).not.toHaveBeenCalled();

    displayPreset.onChange("standard");
    expect(setPref.mock.calls).toEqual([
      ["reader_mode_default", "true"],
      ["web_preview_mode_default", "false"],
    ]);

    setPref.mockClear();
    displayPreset.onChange("preview");
    expect(setPref.mock.calls).toEqual([
      ["reader_mode_default", "true"],
      ["web_preview_mode_default", "true"],
    ]);
  });

  it("exposes an opt-in web preview focus retention switch", () => {
    const setPref = vi.fn();
    const props = buildProps({ setPref });
    const keepFocus = getSwitchControl(props, "web-preview-keep-focus");

    expect(keepFocus).toEqual(
      expect.objectContaining({
        label: t("reading.web_preview_keep_focus"),
        checked: false,
      }),
    );

    keepFocus.onChange(true);
    expect(setPref).toHaveBeenCalledWith("web_preview_keep_focus", "true");
  });

  it("exposes an always-on-top switch for manga-style web preview sites", () => {
    const setPref = vi.fn();
    const props = buildProps({ platformKind: "windows", setPref });
    const alwaysOnTop = getSwitchControl(props, "window-always-on-top");

    expect(alwaysOnTop).toEqual(
      expect.objectContaining({
        label: t("reading.window_always_on_top"),
        checked: false,
      }),
    );

    alwaysOnTop.onChange(true);
    expect(setPref).toHaveBeenCalledWith("window_always_on_top", "true");
  });

  it("moves article list grouping and scrolling controls into reading settings", () => {
    const setPref = vi.fn();
    const props = buildProps({
      prefs: {
        group_by: "feed",
        scroll_to_top_on_change: "true",
      },
      setPref,
      supportsBackgroundBrowserOpen: false,
    });
    const articleListSection = props.sections.find((section) => section.id === "article-list");
    const groupBy = getSelectControl(props, "group-by");
    const scrollToTop = getSwitchControl(props, "scroll-to-top-on-change");

    expect(articleListSection?.controls.map((control) => control.id)).toEqual([
      "reading-sort",
      "group-by",
      "open-first-article-on-feed-selection",
      "scroll-to-top-on-change",
    ]);
    expect(groupBy).toEqual(expect.objectContaining({ value: "feed" }));
    expect(scrollToTop).toEqual(expect.objectContaining({ checked: true }));

    groupBy.onChange("none");
    scrollToTop.onChange(false);

    expect(setPref).toHaveBeenCalledWith("group_by", "none");
    expect(setPref).toHaveBeenCalledWith("scroll_to_top_on_change", "false");
  });

  it("moves link and Web Preview behavior into reading settings", () => {
    const setPref = vi.fn();
    const props = buildProps({
      prefs: {
        open_links: "default_browser",
        open_links_background: "true",
        cmd_click_browser: "true",
      },
      platformKind: "windows",
      setPref,
    });
    const originalArticleSection = props.sections.find((section) => section.id === "original-article");
    const openLinks = getSelectControl(props, "open-links");
    const backgroundControl = getSwitchControl(props, "open-links-background");
    const shortcutControl = getSwitchControl(props, "cmd-click-browser");

    expect(originalArticleSection?.note).toBe(t("reading.open_links_background_note"));
    expect(openLinks).toEqual(expect.objectContaining({ value: "default_browser" }));
    expect(backgroundControl).toEqual(expect.objectContaining({ checked: true, disabled: false }));
    expect(shortcutControl).toEqual(
      expect.objectContaining({
        label: t("reading.cmd_click_browser", { modifier: "Ctrl" }),
        checked: true,
      }),
    );

    openLinks.onChange("in_app");
    backgroundControl.onChange(false);
    shortcutControl.onChange(false);

    expect(setPref).toHaveBeenCalledWith("open_links", "in_app");
    expect(setPref).toHaveBeenCalledWith("open_links_background", "false");
    expect(setPref).toHaveBeenCalledWith("cmd_click_browser", "false");
  });

  it("opens the display preset control for the reading display mode dev intent", () => {
    const props = buildProps({
      devIntent: DEV_SCENARIO_ID.openSettingsReadingDisplayMode,
    });

    expect(getSelectControl(props, "display-preset")).toEqual(expect.objectContaining({ open: true }));
  });

  it("disables recent history clearing and skips confirm when no account is selected", () => {
    const showConfirm = vi.fn();
    const clearHistory = {
      isPending: false,
      mutate: vi.fn(),
    };
    const props = buildProps({ clearHistory, selectedAccountId: null, showConfirm });

    expect(getActionControl(props, "clear-recent-articles")).toEqual(
      expect.objectContaining({
        actionLabel: t("reading.clear_recent_articles"),
        actionAriaLabel: t("reading.clear_recent_articles_aria_label"),
        actionLoading: false,
        actionLoadingLabel: t("reading.clearing_recent_articles"),
        disabled: true,
      }),
    );

    getActionControl(props, "clear-recent-articles").onAction?.();

    expect(showConfirm).not.toHaveBeenCalled();
    expect(clearHistory.mutate).not.toHaveBeenCalled();
  });

  it("marks recent history clearing as busy while the mutation is pending", () => {
    const props = buildProps({
      selectedAccountId: "acc-1",
      clearHistory: {
        isPending: true,
        mutate: vi.fn(),
      },
    });

    expect(getActionControl(props, "clear-recent-articles")).toEqual(
      expect.objectContaining({
        actionLabel: t("reading.clear_recent_articles"),
        actionLoading: true,
        actionLoadingLabel: t("reading.clearing_recent_articles"),
        disabled: true,
      }),
    );
  });

  it.each([
    "   ",
    "\n",
  ])("disables recent history clearing and skips confirm when selected account id is blank %#", (selectedAccountId) => {
    const showConfirm = vi.fn();
    const clearHistory = {
      isPending: false,
      mutate: vi.fn(),
    };
    const props = buildProps({ clearHistory, selectedAccountId, showConfirm });

    expect(getActionControl(props, "clear-recent-articles")).toEqual(
      expect.objectContaining({
        disabled: true,
      }),
    );

    getActionControl(props, "clear-recent-articles").onAction?.();

    expect(showConfirm).not.toHaveBeenCalled();
    expect(clearHistory.mutate).not.toHaveBeenCalled();
  });

  it("opens destructive recent history confirmation with target and irreversible accessible label", () => {
    const showConfirm = vi.fn();
    const props = buildProps({ selectedAccountId: "acc-1", showConfirm });

    getActionControl(props, "clear-recent-articles").onAction?.();

    expect(showConfirm).toHaveBeenCalledWith(t("reading.confirm_clear_recent_articles"), expect.any(Function), {
      actionLabel: t("reading.clear_recent_articles"),
      actionAccessibleLabel: t("reading.clear_recent_articles_aria_label"),
      variant: "destructive",
    });
  });

  it("maps ja recent history action aria labels from locale keys", () => {
    const tJa = i18n.getFixedT("ja", "settings");
    const props = buildProps({ t: tJa });

    expect(getActionControl(props, "clear-recent-articles").actionAriaLabel).toBe(
      tJa("reading.clear_recent_articles_aria_label"),
    );
  });
});
