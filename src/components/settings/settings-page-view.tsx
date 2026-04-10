import { useId } from "react";
import { GradientSwitch } from "@/components/shared/gradient-switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export type SettingsPageTextControl = {
  id: string;
  type: "text";
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export type SettingsPageActionControl = {
  id: string;
  type: "action";
  label: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
};

export type SettingsPageControl =
  | SettingsPageSelectControl
  | SettingsPageSwitchControl
  | SettingsPageTextControl
  | SettingsPageActionControl;

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

function SettingsPageTextRow({ control }: { control: SettingsPageTextControl }) {
  const labelId = useId();

  return (
    <div className="flex min-h-[44px] items-center gap-4 border-b border-border py-3">
      <label id={labelId} htmlFor={control.name} className="w-40 shrink-0 text-sm text-foreground">
        {control.label}
      </label>
      <Input
        id={control.name}
        name={control.name}
        value={control.value}
        onChange={(event) => control.onChange(event.currentTarget.value)}
        placeholder={control.placeholder}
        disabled={control.disabled}
        aria-labelledby={labelId}
        className="h-10 flex-1"
      />
    </div>
  );
}

function SettingsPageActionRow({ control }: { control: SettingsPageActionControl }) {
  return (
    <div className="flex min-h-[44px] items-center justify-between gap-4 border-b border-border py-3">
      <span className="text-sm text-foreground">{control.label}</span>
      <Button
        type="button"
        variant="outline"
        onClick={control.onAction}
        disabled={control.disabled}
        aria-label={`${control.actionLabel}: ${control.label}`}
      >
        {control.actionLabel}
      </Button>
    </div>
  );
}

export function SettingsPageView({ title, sections }: SettingsPageViewProps) {
  return (
    <div data-testid="settings-page-root" className="p-5 sm:p-6">
      <h2 className="sticky top-0 z-10 -mx-5 mb-5 border-b border-border/70 bg-popover/95 px-5 py-3 text-center text-lg font-semibold backdrop-blur-sm sm:-mx-6 sm:mb-6 sm:px-6">
        {title}
      </h2>
      {sections.map((section, index) => (
        <section key={section.id} className={index === sections.length - 1 ? undefined : "mb-5 sm:mb-6"}>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:mb-3">
            {section.heading}
          </h3>
          {section.controls.map((control) =>
            control.type === "select" ? (
              <SettingsPageSelectRow key={control.id} control={control} />
            ) : control.type === "switch" ? (
              <SettingsPageSwitchRow key={control.id} control={control} />
            ) : control.type === "text" ? (
              <SettingsPageTextRow key={control.id} control={control} />
            ) : (
              <SettingsPageActionRow key={control.id} control={control} />
            ),
          )}
          {section.note && <p className="mt-1.5 text-xs text-muted-foreground sm:mt-2">{section.note}</p>}
        </section>
      ))}
    </div>
  );
}
