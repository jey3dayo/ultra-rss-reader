import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import type { DatabaseSizeStatus } from "./hooks/use-data-settings-controller";

type DataSettingsViewProps = {
  title: string;
  databaseHeading: string;
  databaseSizeLabel: string;
  databaseSizeStatus: DatabaseSizeStatus;
  databaseSizeValue: string;
  databaseSizeLoadingLabel: string;
  databaseSizeErrorLabel: string;
  safetyHeading: string;
  safetyDescription: string;
  safetyChecklist: readonly string[];
  optimizationHeading: string;
  vacuumDescription: string;
  vacuumLabel: string;
  vacuuming: boolean;
  logsHeading: string;
  openLogDirDescription: string;
  openLogDirLabel: string;
  openingLogDir: boolean;
  onVacuum: () => void;
  onOpenLogDir: () => void;
};

export function DataSettingsView({
  title,
  databaseHeading,
  databaseSizeLabel,
  databaseSizeStatus,
  databaseSizeValue,
  databaseSizeLoadingLabel,
  databaseSizeErrorLabel,
  safetyHeading,
  safetyDescription,
  safetyChecklist,
  optimizationHeading,
  vacuumDescription,
  vacuumLabel,
  vacuuming,
  logsHeading,
  openLogDirDescription,
  openLogDirLabel,
  openingLogDir,
  onVacuum,
  onOpenLogDir,
}: DataSettingsViewProps) {
  const databaseSizeDisplayValue =
    databaseSizeStatus === "ready"
      ? databaseSizeValue
      : databaseSizeStatus === "loading"
        ? databaseSizeLoadingLabel
        : databaseSizeErrorLabel;
  const vacuumUnavailable = databaseSizeStatus === "error";
  const vacuumDescriptionText =
    databaseSizeStatus === "error" ? `${vacuumDescription} ${databaseSizeErrorLabel}` : vacuumDescription;

  return (
    <SettingsContentLayout title={title} outerTestId="data-settings-root">
      <SettingsSection heading={databaseHeading} surface="flat" className="mb-6 sm:mb-7">
        <LabeledControlRow label={databaseSizeLabel}>
          <span className="text-sm text-foreground-soft" data-database-size-status={databaseSizeStatus}>
            {databaseSizeDisplayValue}
          </span>
        </LabeledControlRow>
      </SettingsSection>
      <SettingsSection heading={safetyHeading} surface="flat" className="mb-6 sm:mb-7">
        <p className="mb-3 font-serif text-sm text-foreground-soft">{safetyDescription}</p>
        <ul className="list-disc space-y-1 pl-5 font-serif text-sm text-foreground-soft">
          {safetyChecklist.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SettingsSection>
      <SettingsSection heading={optimizationHeading} surface="flat" className="mb-6 sm:mb-7">
        <LabeledControlRow label={vacuumLabel} description={vacuumDescriptionText}>
          {({ descriptionId }) => (
            <SettingsActionButton
              aria-describedby={descriptionId}
              disabled={vacuuming || openingLogDir || vacuumUnavailable}
              onClick={onVacuum}
            >
              {vacuumLabel}
            </SettingsActionButton>
          )}
        </LabeledControlRow>
      </SettingsSection>
      <SettingsSection heading={logsHeading} surface="flat">
        <LabeledControlRow label={openLogDirLabel} description={openLogDirDescription}>
          <SettingsActionButton disabled={openingLogDir || vacuuming} onClick={onOpenLogDir}>
            {openLogDirLabel}
          </SettingsActionButton>
        </LabeledControlRow>
      </SettingsSection>
    </SettingsContentLayout>
  );
}
