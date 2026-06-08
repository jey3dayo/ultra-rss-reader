import { type ChangeEvent, useRef } from "react";
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
  settingsProfileHeading: string;
  settingsProfileDescription: string;
  settingsProfileImportLabel: string;
  settingsProfileImportActionLabel?: string;
  settingsProfileExportLabel: string;
  settingsProfileExportActionLabel?: string;
  settingsProfileFileInputLabel: string;
  importingSettingsProfile: boolean;
  exportingSettingsProfile: boolean;
  optimizationHeading: string;
  vacuumDescription: string;
  vacuumLabel: string;
  vacuumActionLabel?: string;
  vacuuming: boolean;
  logsHeading: string;
  openLogDirDescription: string;
  openLogDirLabel: string;
  openLogDirActionLabel?: string;
  openingLogDir: boolean;
  onVacuum: () => void;
  onOpenLogDir: () => void;
  onImportSettingsProfile: (file: File) => void;
  onExportSettingsProfile: () => void;
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
  settingsProfileHeading,
  settingsProfileDescription,
  settingsProfileImportLabel,
  settingsProfileImportActionLabel,
  settingsProfileExportLabel,
  settingsProfileExportActionLabel,
  settingsProfileFileInputLabel,
  importingSettingsProfile,
  exportingSettingsProfile,
  optimizationHeading,
  vacuumDescription,
  vacuumLabel,
  vacuumActionLabel,
  vacuuming,
  logsHeading,
  openLogDirDescription,
  openLogDirLabel,
  openLogDirActionLabel,
  openingLogDir,
  onVacuum,
  onOpenLogDir,
  onImportSettingsProfile,
  onExportSettingsProfile,
}: DataSettingsViewProps) {
  const settingsProfileFileInputRef = useRef<HTMLInputElement | null>(null);
  const databaseSizeDisplayValue =
    databaseSizeStatus === "ready"
      ? databaseSizeValue
      : databaseSizeStatus === "loading"
        ? databaseSizeLoadingLabel
        : databaseSizeErrorLabel;
  const vacuumUnavailable = databaseSizeStatus !== "ready";
  const vacuumDescriptionText =
    databaseSizeStatus === "ready" ? vacuumDescription : `${vacuumDescription} ${databaseSizeDisplayValue}`;
  const settingsProfileActionUnavailable =
    vacuuming || openingLogDir || importingSettingsProfile || exportingSettingsProfile;

  const handleImportClick = () => {
    settingsProfileFileInputRef.current?.click();
  };

  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (file) {
      onImportSettingsProfile(file);
    }
  };

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
      <SettingsSection heading={settingsProfileHeading} surface="flat" className="mb-6 sm:mb-7">
        <LabeledControlRow label={settingsProfileExportLabel} description={settingsProfileDescription}>
          <SettingsActionButton disabled={settingsProfileActionUnavailable} onClick={onExportSettingsProfile}>
            {settingsProfileExportActionLabel ?? settingsProfileExportLabel}
          </SettingsActionButton>
        </LabeledControlRow>
        <LabeledControlRow label={settingsProfileImportLabel} description={settingsProfileFileInputLabel}>
          <input
            ref={settingsProfileFileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label={settingsProfileFileInputLabel}
            onChange={handleImportFileChange}
          />
          <SettingsActionButton disabled={settingsProfileActionUnavailable} onClick={handleImportClick}>
            {settingsProfileImportActionLabel ?? settingsProfileImportLabel}
          </SettingsActionButton>
        </LabeledControlRow>
      </SettingsSection>
      <SettingsSection heading={optimizationHeading} surface="flat" className="mb-6 sm:mb-7">
        <LabeledControlRow label={vacuumLabel} description={vacuumDescriptionText}>
          {({ descriptionId }) => (
            <SettingsActionButton
              aria-describedby={descriptionId}
              disabled={vacuuming || openingLogDir || vacuumUnavailable}
              onClick={onVacuum}
            >
              {vacuumActionLabel ?? vacuumLabel}
            </SettingsActionButton>
          )}
        </LabeledControlRow>
      </SettingsSection>
      <SettingsSection heading={logsHeading} surface="flat">
        <LabeledControlRow label={openLogDirLabel} description={openLogDirDescription}>
          <SettingsActionButton disabled={openingLogDir || vacuuming} onClick={onOpenLogDir}>
            {openLogDirActionLabel ?? openLogDirLabel}
          </SettingsActionButton>
        </LabeledControlRow>
      </SettingsSection>
    </SettingsContentLayout>
  );
}
