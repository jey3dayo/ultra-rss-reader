import { type ChangeEvent, useRef } from "react";
import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { LabeledControlRow } from "@/design-system";
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

const DATA_ACTION_ROW_CLASS_NAME = "lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-6 [&>div:last-child]:lg:pr-0";

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
  const vacuumActionUnavailable = vacuuming || openingLogDir || vacuumUnavailable;
  const openLogDirActionUnavailable = openingLogDir || vacuuming;

  const handleImportClick = () => {
    if (settingsProfileActionUnavailable) {
      return;
    }
    settingsProfileFileInputRef.current?.click();
  };

  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = "";
    if (file && !settingsProfileActionUnavailable) {
      onImportSettingsProfile(file);
    }
  };

  return (
    <SettingsContentLayout title={title} outerTestId="data-settings-root">
      <SettingsSection heading={databaseHeading} surface="flat" className="mb-6 sm:mb-7">
        <LabeledControlRow label={databaseSizeLabel}>
          <span
            className="text-sm text-foreground-soft"
            data-database-size-status={databaseSizeStatus}
            role="status"
            aria-live="polite"
          >
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
        <LabeledControlRow
          label={settingsProfileExportLabel}
          description={settingsProfileDescription}
          className={DATA_ACTION_ROW_CLASS_NAME}
        >
          <SettingsLoadingActionButton
            disabled={settingsProfileActionUnavailable}
            loading={exportingSettingsProfile}
            loadingLabel={settingsProfileExportActionLabel}
            onClick={onExportSettingsProfile}
          >
            {settingsProfileExportActionLabel ?? settingsProfileExportLabel}
          </SettingsLoadingActionButton>
        </LabeledControlRow>
        <LabeledControlRow
          label={settingsProfileImportLabel}
          description={settingsProfileFileInputLabel}
          className={DATA_ACTION_ROW_CLASS_NAME}
        >
          <input
            ref={settingsProfileFileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label={settingsProfileFileInputLabel}
            disabled={settingsProfileActionUnavailable}
            onChange={handleImportFileChange}
          />
          <SettingsLoadingActionButton
            disabled={settingsProfileActionUnavailable}
            loading={importingSettingsProfile}
            loadingLabel={settingsProfileImportActionLabel}
            onClick={handleImportClick}
          >
            {settingsProfileImportActionLabel ?? settingsProfileImportLabel}
          </SettingsLoadingActionButton>
        </LabeledControlRow>
      </SettingsSection>
      <SettingsSection heading={optimizationHeading} surface="flat" className="mb-6 sm:mb-7">
        <LabeledControlRow
          label={vacuumLabel}
          description={vacuumDescriptionText}
          className={DATA_ACTION_ROW_CLASS_NAME}
        >
          {({ descriptionId }) => (
            <SettingsLoadingActionButton
              aria-describedby={descriptionId}
              disabled={vacuumActionUnavailable}
              loading={vacuuming}
              loadingLabel={vacuumActionLabel}
              onClick={onVacuum}
            >
              {vacuumActionLabel ?? vacuumLabel}
            </SettingsLoadingActionButton>
          )}
        </LabeledControlRow>
      </SettingsSection>
      <SettingsSection heading={logsHeading} surface="flat">
        <LabeledControlRow
          label={openLogDirLabel}
          description={openLogDirDescription}
          className={DATA_ACTION_ROW_CLASS_NAME}
        >
          <SettingsLoadingActionButton
            disabled={openLogDirActionUnavailable}
            loading={openingLogDir}
            loadingLabel={openLogDirActionLabel}
            onClick={onOpenLogDir}
          >
            {openLogDirActionLabel ?? openLogDirLabel}
          </SettingsLoadingActionButton>
        </LabeledControlRow>
      </SettingsSection>
    </SettingsContentLayout>
  );
}
