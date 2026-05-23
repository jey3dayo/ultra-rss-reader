import type { SettingsPageControl, SettingsPageViewProps } from "@/components/settings/settings-page.types";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { LabeledActionInputRow } from "@/components/shared/labeled-action-input-row";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { LabeledSelectRow } from "@/components/shared/labeled-select-row";
import { LabeledSwitchRow } from "@/components/shared/labeled-switch-row";
import { cn } from "@/lib/utils";

type SettingsPageControlRowProps<Control> = {
  control: Control;
};

type SettingsPageSelectControl = Extract<SettingsPageControl, { type: "select" }>;
type SettingsPageSwitchControl = Extract<SettingsPageControl, { type: "switch" }>;
type SettingsPageTextControl = Extract<SettingsPageControl, { type: "text" }>;
type SettingsPageActionControl = Extract<SettingsPageControl, { type: "action" }>;
type SettingsPageInfoControl = Extract<SettingsPageControl, { type: "info" }>;

function SettingsPageSelectRow({ control }: SettingsPageControlRowProps<SettingsPageSelectControl>) {
  return (
    <LabeledSelectRow
      label={control.label}
      name={control.name}
      value={control.value}
      options={control.options}
      onChange={control.onChange}
      disabled={control.disabled}
      open={control.open}
      triggerClassName="sm:w-[192px]"
    />
  );
}

function SettingsPageSwitchRow({ control }: SettingsPageControlRowProps<SettingsPageSwitchControl>) {
  return (
    <LabeledSwitchRow
      label={control.label}
      checked={control.checked}
      onChange={control.onChange}
      disabled={control.disabled}
      labelClassName="sm:whitespace-nowrap"
    />
  );
}

function SettingsPageTextRow({ control }: SettingsPageControlRowProps<SettingsPageTextControl>) {
  if (control.actionLabel && control.onAction) {
    return (
      <LabeledActionInputRow
        label={control.label}
        name={control.name}
        value={control.value}
        onChange={control.onChange}
        placeholder={control.placeholder}
        disabled={control.disabled}
        rowClassName="gap-4"
        labelClassName="w-40 shrink-0"
        inputClassName="h-10 flex-1"
        trailingControls={
          <SettingsActionButton
            type="button"
            size={control.actionSize ?? "compact"}
            onClick={control.onAction}
            disabled={control.disabled || control.actionDisabled}
            aria-label={control.actionAriaLabel}
          >
            {control.actionLabel}
          </SettingsActionButton>
        }
      />
    );
  }

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
      controlClassName="flex w-full items-center gap-2 sm:max-w-[30rem] sm:justify-end"
      inputClassName="h-10 flex-1"
    />
  );
}

function SettingsPageActionRow({ control }: SettingsPageControlRowProps<SettingsPageActionControl>) {
  return (
    <LabeledControlRow
      label={control.label}
      className={control.rowClassName ?? "gap-4"}
      labelClassName={control.labelClassName}
    >
      <SettingsActionButton
        type="button"
        size={control.actionSize ?? "compact"}
        onClick={control.onAction}
        disabled={control.disabled}
        aria-label={control.actionAriaLabel}
      >
        {control.actionLabel}
      </SettingsActionButton>
    </LabeledControlRow>
  );
}

function SettingsPageInfoRow({ control }: SettingsPageControlRowProps<SettingsPageInfoControl>) {
  return (
    <LabeledControlRow label={control.label} className="gap-4">
      <span
        className={cn(
          "block text-right font-serif text-sm leading-[1.45] text-foreground sm:max-w-[30rem]",
          control.valueClassName,
        )}
      >
        {control.value}
      </span>
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
          className={index === sections.length - 1 ? undefined : "mb-6 sm:mb-7"}
          headingClassName="mb-1.5 sm:mb-2"
        >
          {section.controls.map((control) =>
            control.type === "select" ? (
              <SettingsPageSelectRow key={control.id} control={control} />
            ) : control.type === "switch" ? (
              <SettingsPageSwitchRow key={control.id} control={control} />
            ) : control.type === "text" ? (
              <SettingsPageTextRow key={control.id} control={control} />
            ) : control.type === "info" ? (
              <SettingsPageInfoRow key={control.id} control={control} />
            ) : (
              <SettingsPageActionRow key={control.id} control={control} />
            ),
          )}
        </SettingsSection>
      ))}
    </SettingsContentLayout>
  );
}
