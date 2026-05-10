import { renderHook } from "@testing-library/react";
import { createWrapper } from "@tests/helpers/create-wrapper";
import { settingsPreferenceLabelKeys } from "@tests/helpers/settings-fixtures";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { useAppearanceSettingsViewProps } from "@/components/settings/hooks/use-appearance-settings-view-props";
import { useGeneralSettingsViewProps } from "@/components/settings/hooks/use-general-settings-view-props";
import { useReadingSettingsViewProps } from "@/components/settings/hooks/use-reading-settings-view-props";
import type { SettingsPageControl, SettingsPageViewProps } from "@/components/settings/settings-page.types";
import type { SettingsPreferenceViewPropsParams } from "@/components/settings/settings-preference.types";
import i18n from "@/lib/i18n";
import { type KnownPreferenceKey, preferenceSchemas } from "@/schemas/preferences";

const t = i18n.getFixedT("en", "settings");

function expectPreferenceWriteMatchesSchema(key: string, value: string) {
  const schema = preferenceSchemas[key as keyof typeof preferenceSchemas];

  expect(schema, `Missing preference schema for ${key}`).toBeDefined();
  expect(schema?.safeParse(value).success, `Invalid value ${value} for ${key}`).toBe(true);
  expect(settingsPreferenceLabelKeys, `Missing settings preference fixture owner for ${key}`).toHaveProperty(key);
}

function assertControlSchemaParity(control: SettingsPageControl, setPref: ReturnType<typeof vi.fn>) {
  if (control.type === "select") {
    const schema = preferenceSchemas[control.name as keyof typeof preferenceSchemas];

    if (schema) {
      for (const option of control.options) {
        expect(schema.safeParse(option.value).success, `Invalid option ${option.value} for ${control.name}`).toBe(true);
      }
    }

    for (const option of control.options) {
      setPref.mockClear();
      control.onChange(option.value);
      for (const [key, value] of setPref.mock.calls) {
        expectPreferenceWriteMatchesSchema(String(key), String(value));
      }
    }
    return;
  }

  if (control.type === "switch") {
    setPref.mockClear();
    control.onChange(!control.checked);
    for (const [key, value] of setPref.mock.calls) {
      expectPreferenceWriteMatchesSchema(String(key), String(value));
    }
  }
}

function assertSettingsPreferenceSchemaParity(props: SettingsPageViewProps, setPref: ReturnType<typeof vi.fn>) {
  for (const control of props.sections.flatMap((section) => section.controls)) {
    assertControlSchemaParity(control, setPref);
  }
}

describe("settings preference option schema parity", () => {
  it("keeps settings preference writes bounded to known schema keys", () => {
    expectTypeOf<Parameters<SettingsPreferenceViewPropsParams["setPref"]>[0]>().toEqualTypeOf<KnownPreferenceKey>();
  });

  it("keeps general settings writes aligned with preference schemas", () => {
    const setPref = vi.fn();
    const props = useGeneralSettingsViewProps({ t, prefs: {}, setPref });

    assertSettingsPreferenceSchemaParity(props, setPref);
  });

  it("keeps appearance settings writes aligned with preference schemas", () => {
    const setPref = vi.fn();
    const props = useAppearanceSettingsViewProps({ t, prefs: {}, setPref });

    assertSettingsPreferenceSchemaParity(props, setPref);
  });

  it("keeps reading settings writes aligned with preference schemas", () => {
    const setPref = vi.fn();
    const { result } = renderHook(
      () =>
        useReadingSettingsViewProps({
          t,
          prefs: {},
          setPref,
          devIntent: null,
          platformKind: "macos",
          supportsBackgroundBrowserOpen: true,
        }),
      { wrapper: createWrapper() },
    );

    assertSettingsPreferenceSchemaParity(result.current, setPref);
  });
});
