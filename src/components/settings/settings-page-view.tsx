import { SettingsContentLayout } from "@/components/settings/settings-content-layout";
import type {
  SettingsPageActionRowProps,
  SettingsPageSelectRowProps,
  SettingsPageSwitchRowProps,
  SettingsPageTextRowProps,
  SettingsPageViewProps,
} from "@/components/settings/settings-page.types";
import { SettingsSection } from "@/components/settings/settings-section";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { Button } from "@/components/ui/button";

function SettingsPageSelectRow({ control }: SettingsPageSelectRowProps) {
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

function SettingsPageSwitchRow({ control }: SettingsPageSwitchRowProps) {
  return (
    <LabeledSwitchRow
      label={control.label}
      checked={control.checked}
      onChange={control.onChange}
      disabled={control.disabled}
    />
  );
}

function SettingsPageTextRow({ control }: SettingsPageTextRowProps) {
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
      actionLabel={control.actionLabel}
      actionAriaLabel={control.actionAriaLabel}
      onAction={control.onAction}
      actionDisabled={control.actionDisabled}
    />
  );
}

function SettingsPageActionRow({ control }: SettingsPageActionRowProps) {
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

export function SettingsPageView({ title, sections, sectionSurface = "flat" }: SettingsPageViewProps) {
  return (
    <SettingsContentLayout title={title} outerTestId="settings-page-root">
      {sections.map((section, index) => (
        <SettingsSection
          key={section.id}
          heading={section.heading}
          note={section.note}
          surface={sectionSurface}
          className={index === sections.length - 1 ? undefined : "mb-4 sm:mb-5"}
          headingClassName="mb-3 sm:mb-4"
        >
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
        </SettingsSection>
      ))}
    </SettingsContentLayout>
  );
}
