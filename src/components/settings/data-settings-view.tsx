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
  backupLabel: string;
  backupDescription: string;
  backupActionLabel?: string;
  backingUp: boolean;
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
  onBackupDatabase: () => void;
  onOpenLogDir: () => void;
  onImportSettingsProfile: (file: File) => void;
  onExportSettingsProfile: () => void;
};

const DATA_ACTION_ROW_CLASS_NAME =
  "lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-6 [&>div:last-child]:lg:justify-end [&>div:last-child]:lg:pr-0";

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
  backupLabel,
  backupDescription,
  backupActionLabel,
  backingUp,
  settingsProfileHeading,
  settingsProfileDescription,
  settingsProfileImportLabel,
  settingsProfileImportActionLabel,
  settingsProfileExportLabel,
  settingsProfileExportActionLabel,
  settingsProfileFileInputLabel,
  importingSettingsProfile,
  exportingSettingsProfile,
  optimizationHeading: _optimizationHeading,
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
  onBackupDatabase,
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
    backingUp || vacuuming || openingLogDir || importingSettingsProfile || exportingSettingsProfile;
  const vacuumActionUnavailable = backingUp || vacuuming || openingLogDir || vacuumUnavailable;
  const backupActionUnavailable =
    backingUp || vacuuming || openingLogDir || importingSettingsProfile || exportingSettingsProfile;
  const openLogDirActionUnavailable = backingUp || openingLogDir || vacuuming;

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
    <SettingsContentLayout title={title} titleLayout="stacked-left" outerTestId="data-settings-root">
      <div className="grid max-w-[760px] gap-3.5">
        <SettingsSection heading={databaseHeading} surface="flat" className="px-3 py-2.5 sm:px-4 sm:py-3">
          <LabeledControlRow label={databaseSizeLabel} className="py-2.5">
            <span
              className="text-sm text-foreground-soft"
              data-database-size-status={databaseSizeStatus}
              role="status"
              aria-live="polite"
            >
              {databaseSizeDisplayValue}
            </span>
          </LabeledControlRow>
          <LabeledControlRow
            label={vacuumLabel}
            description={vacuumDescriptionText}
            className={DATA_ACTION_ROW_CLASS_NAME}
          >
            {({ descriptionId }) => (
              <SettingsLoadingActionButton
                aria-describedby={descriptionId}
                size="standalone"
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

        <SettingsSection
          heading={safetyHeading}
          surface="flat"
          className="px-3 py-2.5 sm:px-4 sm:py-3"
          contentClassName="[&>*:last-child]:pb-0"
        >
          <p className="border-b border-[var(--settings-shell-divider-border)] pb-2 text-[13px] leading-5 text-foreground">
            {safetyDescription}
          </p>
          <ol className="text-[13px] leading-5 text-foreground-soft">
            {safetyChecklist.map((item, index) => (
              <li
                key={item}
                className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2 border-b border-[var(--settings-shell-divider-border)] py-2"
              >
                <span
                  className="mt-0.5 inline-flex size-5 items-center justify-center rounded-md bg-surface-2 font-mono text-[11px] leading-none text-foreground-soft"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
          <LabeledControlRow label={backupLabel} description={backupDescription} className={DATA_ACTION_ROW_CLASS_NAME}>
            {({ descriptionId }) => (
              <SettingsLoadingActionButton
                aria-describedby={descriptionId}
                size="standalone"
                disabled={backupActionUnavailable}
                loading={backingUp}
                loadingLabel={backupActionLabel}
                onClick={onBackupDatabase}
              >
                {backupActionLabel ?? backupLabel}
              </SettingsLoadingActionButton>
            )}
          </LabeledControlRow>
        </SettingsSection>

        <SettingsSection heading={settingsProfileHeading} surface="flat" className="px-3 py-2.5 sm:px-4 sm:py-3">
          <LabeledControlRow
            label={settingsProfileExportLabel}
            description={settingsProfileDescription}
            className={DATA_ACTION_ROW_CLASS_NAME}
          >
            <SettingsLoadingActionButton
              size="standalone"
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
              size="standalone"
              disabled={settingsProfileActionUnavailable}
              loading={importingSettingsProfile}
              loadingLabel={settingsProfileImportActionLabel}
              onClick={handleImportClick}
            >
              {settingsProfileImportActionLabel ?? settingsProfileImportLabel}
            </SettingsLoadingActionButton>
          </LabeledControlRow>
        </SettingsSection>

        <SettingsSection heading={logsHeading} surface="flat" className="px-3 py-2.5 sm:px-4 sm:py-3">
          <LabeledControlRow
            label={openLogDirLabel}
            description={openLogDirDescription}
            className={DATA_ACTION_ROW_CLASS_NAME}
          >
            <SettingsLoadingActionButton
              size="standalone"
              disabled={openLogDirActionUnavailable}
              loading={openingLogDir}
              loadingLabel={openLogDirActionLabel}
              onClick={onOpenLogDir}
            >
              {openLogDirActionLabel ?? openLogDirLabel}
            </SettingsLoadingActionButton>
          </LabeledControlRow>
        </SettingsSection>
      </div>
    </SettingsContentLayout>
  );
}
