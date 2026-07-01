import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import type { SettingsPageControl, SettingsPageViewProps } from "@/components/settings/settings-page.types";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { SETTINGS_CONTROL_SURFACE_CLASS } from "@/components/settings/shared/settings-surface";
import { MOTION_CONTENT_SWAP_CLASS_NAME } from "@/constants/motion";
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

const SETTINGS_PAGE_INLINE_ROW_CLASS = "gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-4";

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
      rowClassName={SETTINGS_PAGE_INLINE_ROW_CLASS}
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
      rowClassName={cn(SETTINGS_PAGE_INLINE_ROW_CLASS, control.rowClassName)}
      labelClassName={cn("max-w-[24rem]", control.labelClassName)}
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
        rowClassName="gap-3 lg:grid-cols-1 lg:items-start [&>div]:lg:justify-start [&>div]:lg:pr-0"
        inputClassName={cn("h-11 flex-1", SETTINGS_CONTROL_SURFACE_CLASS)}
        trailingControls={
          <SettingsActionButton
            type="button"
            size={control.actionSize ?? "compact"}
            onClick={() => control.onAction(control.value)}
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
      rowClassName="gap-3 lg:grid-cols-1 lg:items-start [&>div]:lg:justify-start [&>div]:lg:pr-0"
      controlClassName="flex w-full items-center gap-2 sm:max-w-[30rem]"
      inputClassName={cn("h-11 flex-1", SETTINGS_CONTROL_SURFACE_CLASS)}
    />
  );
}

function SettingsPageActionRow({ control }: SettingsPageControlRowProps<SettingsPageActionControl>) {
  return (
    <LabeledControlRow
      label={control.label}
      className={control.rowClassName ?? SETTINGS_PAGE_INLINE_ROW_CLASS}
      labelClassName={control.labelClassName}
    >
      <SettingsLoadingActionButton
        type="button"
        size={control.actionSize ?? "standalone"}
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
  const usesStackedValue = control.value.length > 22;
  const usesCodeValue = control.valueTone === "code";

  if (usesStackedValue) {
    return (
      <LabeledControlRow
        label={control.label}
        className="gap-2 lg:grid-cols-1 lg:items-start [&>div]:lg:justify-start [&>div]:lg:pr-0"
      >
        <span
          className={cn(
            "block max-w-full text-left text-[13px] leading-[1.55] break-words text-foreground",
            usesCodeValue && "font-mono",
            control.valueClassName,
          )}
        >
          {control.value}
        </span>
      </LabeledControlRow>
    );
  }

  return (
    <LabeledControlRow label={control.label} className={SETTINGS_PAGE_INLINE_ROW_CLASS}>
      <span
        className={cn(
          "block text-right text-sm leading-[1.45] whitespace-nowrap text-foreground sm:max-w-[30rem]",
          usesCodeValue && "font-mono text-[13px]",
          control.valueClassName,
        )}
      >
        {control.value}
      </span>
    </LabeledControlRow>
  );
}

const sectionColumnKeys = ["primary", "secondary"] as const;

export function SettingsPageView({ title, sections, sectionSurface = "flat" }: SettingsPageViewProps) {
  const usesSectionGrid = sections.length > 1;
  const gridColumns = usesSectionGrid
    ? [sections.filter((_, index) => index % 2 === 0), sections.filter((_, index) => index % 2 === 1)]
    : [sections];

  const renderSection = (section: SettingsPageViewProps["sections"][number], index: number) => (
    <SettingsSection
      key={section.id}
      heading={section.heading}
      note={section.note}
      surface={sectionSurface}
      motionPhase={section.motionPhase}
      className={cn(
        section.motionPhase && MOTION_CONTENT_SWAP_CLASS_NAME,
        sectionSurface === "flat" &&
          (section.density === "compact" ? "px-3 py-2 sm:px-3 sm:py-2" : "px-3 py-2.5 sm:px-4 sm:py-3"),
        !usesSectionGrid && index !== sections.length - 1 && "mb-4 sm:mb-5",
      )}
      headingClassName={cn("text-[11px] tracking-[0.04em]", section.density === "compact" ? "mb-1 sm:mb-1" : undefined)}
      noteClassName={section.density === "compact" ? "mt-1 text-[12px] leading-4 sm:mt-1" : undefined}
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
  );

  return (
    <SettingsContentLayout title={title} titleLayout="stacked-left" outerTestId="settings-page-root">
      <div
        data-testid={usesSectionGrid ? "settings-section-grid" : undefined}
        className={cn(usesSectionGrid ? "grid gap-3 xl:grid-cols-2 xl:items-start xl:gap-4" : undefined)}
      >
        {gridColumns.map((columnSections, columnIndex) => (
          <div
            key={sectionColumnKeys[columnIndex] ?? columnSections.map((section) => section.id).join(":")}
            data-testid={usesSectionGrid ? "settings-section-column" : undefined}
            className={cn(usesSectionGrid && "grid gap-3 xl:gap-4")}
          >
            {columnSections.map((section, index) => renderSection(section, index))}
          </div>
        ))}
      </div>
    </SettingsContentLayout>
  );
}
