import { useId } from "react";
import { SectionHeading } from "@/components/settings/settings-components";
import { GradientSwitch } from "@/components/shared/gradient-switch";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SettingsPageOption = {
  value: string;
  label: string;
};

export type SettingsPageSelectControl = {
  id: string;
  type: "select";
  name: string;
  label: string;
  value: string;
  options: SettingsPageOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  open?: boolean;
};

export type SettingsPageSwitchControl = {
  id: string;
  type: "switch";
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

export type SettingsPageControl = SettingsPageSelectControl | SettingsPageSwitchControl;

export type SettingsPageSection = {
  id: string;
  heading: string;
  controls: SettingsPageControl[];
  note?: string;
};

export type SettingsPageViewProps = {
  title: string;
  sections: SettingsPageSection[];
};

function getOptionLabel(options: SettingsPageOption[], value: string | null) {
  return options.find((option) => option.value === (value ?? ""))?.label ?? value ?? "";
}

function SettingsPageSelectRow({ control }: { control: SettingsPageSelectControl }) {
  const labelId = useId();

  return (
    <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
      <span id={labelId} className="text-sm text-foreground">
        {control.label}
      </span>
      <Select
        name={control.name}
        value={control.value}
        onValueChange={(value) => value !== null && control.onChange(value)}
        disabled={control.disabled}
        open={control.open}
      >
        <SelectTrigger aria-labelledby={labelId} className="min-w-[140px]">
          <SelectValue>{(value: string | null) => getOptionLabel(control.options, value)}</SelectValue>
        </SelectTrigger>
        <SelectPopup>
          {control.options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectPopup>
      </Select>
    </div>
  );
}

function SettingsPageSwitchRow({ control }: { control: SettingsPageSwitchControl }) {
  const labelId = useId();

  return (
    <div className="flex min-h-[44px] items-center justify-between border-b border-border py-3">
      <span id={labelId} className="text-sm text-foreground">
        {control.label}
      </span>
      <GradientSwitch
        checked={control.checked}
        onCheckedChange={(checked) => control.onChange(checked)}
        disabled={control.disabled}
        aria-labelledby={labelId}
      />
    </div>
  );
}

export function SettingsPageView({ title, sections }: SettingsPageViewProps) {
  return (
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">{title}</h2>
      {sections.map((section, index) => (
        <section key={section.id} className={index === sections.length - 1 ? undefined : "mb-6"}>
          <SectionHeading>{section.heading}</SectionHeading>
          {section.controls.map((control) =>
            control.type === "select" ? (
              <SettingsPageSelectRow key={control.id} control={control} />
            ) : (
              <SettingsPageSwitchRow key={control.id} control={control} />
            ),
          )}
          {section.note && <p className="mt-2 text-xs text-muted-foreground">{section.note}</p>}
        </section>
      ))}
    </div>
  );
}
