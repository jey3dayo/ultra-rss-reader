import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import type { SettingsPageControl, SettingsPageViewProps } from "@/components/settings/settings-page.types";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { SETTINGS_CONTROL_SURFACE_CLASS } from "@/components/settings/shared/settings-surface";
import {
  LabeledActionInputRow,
  LabeledControlRow,
  LabeledInputRow,
  LabeledSelectRow,
  LabeledSwitchRow,
} from "@/design-system";
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
      triggerClassName={cn(SETTINGS_CONTROL_SURFACE_CLASS, "sm:w-[192px]")}
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
        inputClassName={cn("h-11 flex-1", SETTINGS_CONTROL_SURFACE_CLASS)}
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
      inputClassName={cn("h-11 flex-1", SETTINGS_CONTROL_SURFACE_CLASS)}
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
      <SettingsLoadingActionButton
        type="button"
        size={control.actionSize ?? "compact"}
        onClick={control.onAction}
        disabled={control.disabled}
        loading={control.actionLoading}
        loadingLabel={control.actionLoadingLabel}
        aria-label={control.actionAriaLabel}
      >
        {control.actionLabel}
      </SettingsLoadingActionButton>
    </LabeledControlRow>
  );
}

function SettingsPageInfoRow({ control }: SettingsPageControlRowProps<SettingsPageInfoControl>) {
  return (
    <LabeledControlRow label={control.label} className="gap-4">
      <span
        className={cn(
          "block text-right font-serif text-sm leading-[1.45] break-words text-foreground sm:max-w-[30rem]",
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
          className={index === sections.length - 1 ? undefined : "mb-4 sm:mb-5"}
          headingClassName="text-[11px] tracking-[0.04em]"
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
