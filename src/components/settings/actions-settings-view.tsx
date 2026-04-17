import { SettingsContentLayout } from "@/components/settings/settings-content-layout";
import { SettingsSection } from "@/components/settings/settings-section";
import { GradientSwitch } from "@/components/shared/gradient-switch";

export type ActionsSettingsService = {
  id: string;
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
};

export type ActionsSettingsViewProps = {
  title: string;
  heading: string;
  toggleLabel: string;
  services: ActionsSettingsService[];
};

export function ActionsSettingsView({ title, heading, toggleLabel, services }: ActionsSettingsViewProps) {
  return (
    <SettingsContentLayout title={title} outerTestId="actions-settings-root">
      <SettingsSection heading={heading} surface="flat">
        {services.map((service) => (
          <div key={service.id} className="flex min-h-[56px] items-center gap-3 border-b border-border py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-1/72 text-foreground-soft">
              {service.icon}
            </span>
            <span className="flex-1 text-sm text-foreground">{service.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground-soft">{toggleLabel}</span>
              <GradientSwitch
                checked={service.checked}
                onCheckedChange={(checked) => service.onCheckedChange(checked)}
                aria-label={toggleLabel}
              />
            </div>
          </div>
        ))}
      </SettingsSection>
    </SettingsContentLayout>
  );
}
