import { SettingsActionButton } from "@/components/settings/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/settings-content-layout";
import { SettingsSection } from "@/components/settings/settings-section";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";

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
        <LabeledControlRow label={vacuumLabel} description={vacuumDescription}>
          <SettingsActionButton disabled={vacuuming} onClick={onVacuum}>
            {vacuumLabel}
          </SettingsActionButton>
        </LabeledControlRow>
      </SettingsSection>
      <SettingsSection heading={logsHeading} surface="flat">
        <LabeledControlRow label={openLogDirLabel} description={openLogDirDescription}>
          <SettingsActionButton onClick={onOpenLogDir}>{openLogDirLabel}</SettingsActionButton>
        </LabeledControlRow>
      </SettingsSection>
    </SettingsContentLayout>
  );
}
