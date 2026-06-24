import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { MOTION_CONTENT_SWAP_CLASS_NAME, MOTION_DATA_PHASE_ATTRIBUTE, MOTION_PHASE_ENTERING } from "@/constants/motion";
import { GradientSwitch, LabeledControlRow } from "@/design-system";

type ActionsSettingsActionRow = {
  id: string;
  label: string;
  toggleAriaLabel: string;
  icon: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export type ActionsSettingsViewProps = {
  title: string;
  heading: string;
  toggleLabel: string;
  services: ActionsSettingsActionRow[];
};

export function ActionsSettingsView({ title, heading, toggleLabel, services }: ActionsSettingsViewProps) {
  return (
    <SettingsContentLayout title={title} outerTestId="actions-settings-root">
      <SettingsSection heading={heading} surface="flat">
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
