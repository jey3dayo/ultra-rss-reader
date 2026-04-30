import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReadingSettingsViewProps } from "@/components/settings/reading-settings-view";
import type { SettingsPageActionControl, SettingsPageControl } from "@/components/settings/settings-page.types";
import { useReadingSettingsViewProps } from "@/components/settings/use-reading-settings-view-props";
import { DEV_SCENARIO_ID } from "@/lib/dev-scenario-ids";
import i18n from "@/lib/i18n";
import { useUiStore } from "@/stores/ui-store";
import { createWrapper } from "../../../tests/helpers/create-wrapper";

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

function getActionControl(props: ReadingSettingsViewProps, id: string): SettingsPageActionControl {
  const control = getControl(props, id);

  if (control.type !== "action") {
    throw new Error(`Expected action control: ${id}`);
  }

  return control;
}

describe("useReadingSettingsViewProps", () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("maps display preset and ignores invalid preset writes", () => {
    const setPref = vi.fn();
    const { result } = renderHook(
      () =>
        useReadingSettingsViewProps({
          t,
          prefs: { reader_mode_default: "true", web_preview_mode_default: "true" },
          setPref,
          devIntent: null,
        }),
      { wrapper: createWrapper() },
    );

    const displayPreset = getSelectControl(result.current, "display-preset");

    expect(displayPreset).toEqual(
      expect.objectContaining({
        name: "display_preset",
        label: t("reading.default_display_mode"),
        value: "preview",
      }),
    );
    expect(displayPreset).not.toHaveProperty("open");

    displayPreset.onChange("invalid");
    expect(setPref).not.toHaveBeenCalled();

    displayPreset.onChange("standard");
    expect(setPref).toHaveBeenCalledWith("reader_mode_default", "true");
    expect(setPref).toHaveBeenCalledWith("web_preview_mode_default", "false");
  });

  it("opens the display preset control for the reading display mode dev intent", () => {
    const { result } = renderHook(
      () =>
        useReadingSettingsViewProps({
          t,
          prefs: {},
          setPref: vi.fn(),
          devIntent: DEV_SCENARIO_ID.openSettingsReadingDisplayMode,
        }),
      { wrapper: createWrapper() },
    );

    expect(getSelectControl(result.current, "display-preset")).toEqual(expect.objectContaining({ open: true }));
  });

  it("disables recent history clearing until an account is selected", () => {
    const { result } = renderHook(
      () =>
        useReadingSettingsViewProps({
          t,
          prefs: {},
          setPref: vi.fn(),
          devIntent: null,
        }),
      { wrapper: createWrapper() },
    );

    expect(getActionControl(result.current, "clear-recent-articles")).toEqual(
      expect.objectContaining({
        actionLabel: t("reading.clear_recent_articles"),
        disabled: true,
      }),
    );
  });
});
