import type { LabeledSelectOption } from "@/components/shared/form-row.types";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { resolvePreferenceValue } from "@/schemas/preferences";
import { usePreferencesStore } from "@/stores/preferences-store";

export { SectionHeading } from "@/components/shared/section-heading";

export type SettingsSwitchProps = {
  label: string;
  prefKey: string;
};

export function SettingsSwitch({ label, prefKey }: SettingsSwitchProps) {
  const checked = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, prefKey) === "true");
  const setPref = usePreferencesStore((s) => s.setPref);
  return <LabeledSwitchRow label={label} checked={checked} onChange={(value) => setPref(prefKey, String(value))} />;
}

type SelectOption = LabeledSelectOption;

export type SettingsSelectProps = {
  label: string;
  prefKey: string;
  options: SelectOption[];
};

export function SettingsSelect({ label, prefKey, options }: SettingsSelectProps) {
  const value = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, prefKey));
  const setPref = usePreferencesStore((s) => s.setPref);

  return (
    <LabeledSelectRow
      label={label}
      name={prefKey}
      value={value}
      options={options}
      onChange={(nextValue) => setPref(prefKey, nextValue)}
      triggerClassName="sm:w-[192px]"
    />
  );
}
