import type { LabeledSelectOption } from "@/components/shared/form-row.types";
import { GradientSwitch } from "@/components/shared/gradient-switch";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { cn } from "@/lib/utils";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";

export { SectionHeading } from "@/components/shared/section-heading";

export function SettingsSwitch({ label, prefKey }: { label: string; prefKey: string }) {
  const checked = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, prefKey) === "true");
  const setPref = usePreferencesStore((s) => s.setPref);
  return <LabeledSwitchRow label={label} checked={checked} onChange={(value) => setPref(prefKey, String(value))} />;
}

type SelectOption = LabeledSelectOption;

export function SettingsSelect({
  label,
  prefKey,
  options,
}: {
  label: string;
  prefKey: string;
  options: SelectOption[];
}) {
  const value = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, prefKey));
  const setPref = usePreferencesStore((s) => s.setPref);

  return (
    <LabeledSelectRow
      label={label}
      name={prefKey}
      value={value}
      options={options}
      onChange={(nextValue) => setPref(prefKey, nextValue)}
      triggerClassName="min-w-[140px]"
    />
  );
}

/** Read-only display row for account detail settings. GradientSwitch is intentionally
 *  disabled — these values are synced from the backend and not user-editable here.
 *  Use SettingsGradientSwitch/SettingsSelect for interactive preference rows. */
export type SettingsRowProps =
  | { label: string; type: "switch"; checked?: boolean }
  | { label: string; type: "select"; value?: string }
  | { label: string; type: "text"; value?: string; truncate?: boolean };

export function SettingsRow(props: SettingsRowProps) {
  return (
    <LabeledControlRow label={props.label}>
      {props.type === "switch" && <GradientSwitch checked={props.checked} disabled />}
      {props.type === "select" && <span className="text-sm text-muted-foreground">{props.value} &#9662;</span>}
      {props.type === "text" && (
        <span className={cn("text-sm text-muted-foreground", props.truncate && "max-w-[200px] truncate")}>
          {props.value}
        </span>
      )}
    </LabeledControlRow>
  );
}
