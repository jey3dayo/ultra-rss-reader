import type {
  ActionsSettingsServiceViewModel,
  ActionsSettingsViewModel,
} from "@/components/settings/lib/actions-settings-view-model";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import { GradientSwitch, LabeledControlRow } from "@/design-system";

type ActionsSettingsActionRow = Omit<ActionsSettingsServiceViewModel, "id"> & {
  // The view only uses `id` as a list key, so it stays a plain string here;
  // stories render illustrative multi-service rows with ids that are not
  // (yet) part of ActionsSettingsServiceId.
  id: string;
  icon: React.ReactNode;
};

export type ActionsSettingsViewProps = Omit<ActionsSettingsViewModel, "services"> & {
  services: ActionsSettingsActionRow[];
};

export function ActionsSettingsView({ title, heading, toggleLabel, services }: ActionsSettingsViewProps) {
  return (
    <SettingsContentLayout title={title} titleLayout="stacked-left" outerTestId="actions-settings-root">
      <SettingsSection heading={heading} surface="flat" className="px-3 py-2.5 sm:px-4 sm:py-3">
        {services.map((service) => (
          <LabeledControlRow
            key={service.id}
            label={service.label}
            leading={service.icon}
            {...{ [MOTION_DATA_PHASE_ATTRIBUTE]: MOTION_PHASE_ENTERING }}
            className={MOTION_CONTENT_SWAP_CLASS_NAME}
          >
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-foreground-soft">{toggleLabel}</span>
              <GradientSwitch
                checked={service.checked}
                onCheckedChange={(checked) => service.onCheckedChange(checked)}
                aria-label={service.toggleAriaLabel}
              />
            </div>
          </LabeledControlRow>
        ))}
      </SettingsSection>
    </SettingsContentLayout>
  );
}
