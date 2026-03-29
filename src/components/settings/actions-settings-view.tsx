import { SectionHeading } from "@/components/settings/settings-components";
import { Switch } from "@/components/ui/switch";

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
    <div className="p-6">
      <h2 className="mb-6 text-center text-lg font-semibold">{title}</h2>

      <section>
        <SectionHeading>{heading}</SectionHeading>
        {services.map((service) => (
          <div key={service.id} className="flex min-h-[56px] items-center gap-3 border-b border-border py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
              {service.icon}
            </span>
            <span className="flex-1 text-sm text-foreground">{service.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{toggleLabel}</span>
              <Switch
                checked={service.checked}
                onCheckedChange={(checked) => service.onCheckedChange(checked)}
                aria-label={toggleLabel}
                className="data-[state=checked]:bg-ring"
              />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
