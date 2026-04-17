import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { SettingsContentLayout } from "@/components/settings/settings-content-layout";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";

export type DataSettingsViewProps = {
  title: string;
  databaseHeading: string;
  databaseSizeLabel: string;
  databaseSizeValue: string;
  optimizationHeading: string;
  vacuumDescription: string;
  vacuumLabel: string;
  vacuuming: boolean;
  logsHeading: string;
  openLogDirDescription: string;
  openLogDirLabel: string;
  onVacuum: () => void;
  onOpenLogDir: () => void;
};

export function DataSettingsView({
  title,
  databaseHeading,
  databaseSizeLabel,
  databaseSizeValue,
  optimizationHeading,
  vacuumDescription,
  vacuumLabel,
  vacuuming,
  logsHeading,
  openLogDirDescription,
  openLogDirLabel,
  onVacuum,
  onOpenLogDir,
}: DataSettingsViewProps) {
  return (
    <SettingsContentLayout title={title} outerTestId="data-settings-root">
      <SettingsSection heading={databaseHeading} surface="flat" className="mb-6 sm:mb-7">
        <LabeledControlRow label={databaseSizeLabel}>
          <span className="text-sm text-foreground-soft">{databaseSizeValue}</span>
        </LabeledControlRow>
      </SettingsSection>
      <SettingsSection heading={optimizationHeading} surface="flat" className="mb-6 sm:mb-7">
        <p className="mb-2.5 text-xs text-foreground-soft sm:mb-3">{vacuumDescription}</p>
        <div className="flex justify-end">
          <Button variant="outline" className="h-10 w-full px-4 sm:w-auto" disabled={vacuuming} onClick={onVacuum}>
            {vacuumLabel}
          </Button>
        </div>
      </SettingsSection>
      <SettingsSection heading={logsHeading} surface="flat">
        <p className="mb-2.5 text-xs text-foreground-soft sm:mb-3">{openLogDirDescription}</p>
        <div className="flex justify-end">
          <Button variant="outline" className="h-10 w-full px-4 sm:w-auto" onClick={onOpenLogDir}>
            {openLogDirLabel}
          </Button>
        </div>
      </SettingsSection>
    </SettingsContentLayout>
  );
}
