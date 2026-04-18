import { ChevronDownIcon } from "lucide-react";
import type { LabeledSelectOption } from "@/components/shared/form-row.types";
import { GradientSwitch } from "@/components/shared/gradient-switch";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { cn } from "@/lib/utils";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";

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

/** Read-only display row for account detail settings. GradientSwitch is intentionally
 *  disabled — these values are synced from the backend and not user-editable here.
 *  Use SettingsGradientSwitch/SettingsSelect for interactive preference rows. */
export type SettingsRowProps =
  | { label: string; labelClassName?: string; valueClassName?: string; type: "switch"; checked?: boolean }
  | { label: string; labelClassName?: string; valueClassName?: string; type: "select"; value?: string }
  | {
      label: string;
      labelClassName?: string;
      valueClassName?: string;
      type: "text";
      value?: string;
      truncate?: boolean;
    };

export function SettingsRow(props: SettingsRowProps) {
  const valueRailClassName = "flex w-full items-center gap-2 sm:max-w-[30rem] sm:justify-end";
  const valueTextClassName = "flex min-h-10 w-full items-center px-3 text-left text-sm text-foreground-soft";

  return (
    <LabeledControlRow label={props.label} labelClassName={props.labelClassName}>
      {props.type === "switch" && <GradientSwitch checked={props.checked} disabled />}
      {props.type === "select" && (
        <div className={valueRailClassName}>
          <span
            className={cn(
              valueTextClassName,
              "inline-flex justify-between gap-2",
              props.valueClassName,
            )}
          >
            <span>{props.value}</span>
            <ChevronDownIcon className="h-4 w-4 opacity-50" aria-hidden="true" />
          </span>
        </div>
      )}
      {props.type === "text" && (
        <div className={valueRailClassName}>
          <span
            className={cn(
              valueTextClassName,
              props.valueClassName,
            )}
          >
            <span className={cn("min-w-0", props.truncate && "truncate")}>{props.value}</span>
          </span>
        </div>
      )}
    </LabeledControlRow>
  );
}
