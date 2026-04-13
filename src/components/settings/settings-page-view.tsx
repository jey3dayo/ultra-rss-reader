import type {
  SettingsPageActionControl,
  SettingsPageSelectControl,
  SettingsPageSwitchControl,
  SettingsPageTextControl,
  SettingsPageViewProps,
} from "@/components/settings/settings-page.types";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";

function SettingsPageSelectRow({ control }: { control: SettingsPageSelectControl }) {
  return (
    <LabeledSelectRow
      label={control.label}
      name={control.name}
      value={control.value}
      options={control.options}
      onChange={control.onChange}
      disabled={control.disabled}
      open={control.open}
      triggerClassName="min-w-[140px]"
    />
  );
}

function SettingsPageSwitchRow({ control }: { control: SettingsPageSwitchControl }) {
  return (
    <LabeledSwitchRow
      label={control.label}
      checked={control.checked}
      onChange={control.onChange}
      disabled={control.disabled}
    />
  );
}

function SettingsPageTextRow({ control }: { control: SettingsPageTextControl }) {
  return (
    <LabeledInputRow
      label={control.label}
      name={control.name}
      value={control.value}
      onChange={control.onChange}
      placeholder={control.placeholder}
      disabled={control.disabled}
      rowClassName="gap-4"
      labelClassName="w-40 shrink-0"
      inputClassName="h-10 flex-1"
    />
  );
}

function SettingsPageActionRow({ control }: { control: SettingsPageActionControl }) {
  return (
    <LabeledControlRow label={control.label} className="gap-4">
      <Button
        type="button"
        variant="outline"
        onClick={control.onAction}
        disabled={control.disabled}
        aria-label={`${control.actionLabel}: ${control.label}`}
      >
        {control.actionLabel}
      </Button>
    </LabeledControlRow>
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
          <SectionHeading className="mb-2 sm:mb-3">{section.heading}</SectionHeading>
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
