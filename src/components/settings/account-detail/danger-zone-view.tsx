import { type ChangeEvent, useId, useRef } from "react";
import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { DeleteButton } from "@/design-system";

type AccountDangerZoneViewProps = {
  dataHeading: string;
  dangerHeading: string;
  importLabel: string;
  importingLabel?: string;
  exportLabel: string;
  exportingLabel?: string;
  localSyncHeading?: string;
  localSyncDescription?: string;
  localSyncFolderLabel?: string;
  localSyncFolderPlaceholder?: string;
  localSyncFolderValue?: string;
  onLocalSyncFolderChange?: (value: string) => void;
  saveLocalSyncFolderLabel?: string;
  savingLocalSyncFolderLabel?: string;
  exportLocalSyncLabel?: string;
  exportingLocalSyncLabel?: string;
  importLocalSyncLabel?: string;
  importingLocalSyncLabel?: string;
  onSaveLocalSyncFolder?: () => void;
  onExportLocalSync?: () => void;
  onImportLocalSync?: () => void;
  loadingLocalSyncFolder?: boolean;
  savingLocalSyncFolder?: boolean;
  exportingLocalSync?: boolean;
  importingLocalSync?: boolean;
  deleteLabel: string;
  onImport: (file: File) => void;
  onExport: () => void;
  onRequestDelete: () => void;
  importing?: boolean;
  exporting?: boolean;
  disabled?: boolean;
  disabledReason?: string;
};

export function AccountDangerZoneView({
  dataHeading,
  dangerHeading,
  importLabel,
  importingLabel,
  exportLabel,
  exportingLabel,
  localSyncHeading,
  localSyncDescription,
  localSyncFolderLabel,
  localSyncFolderPlaceholder,
  localSyncFolderValue = "",
  onLocalSyncFolderChange,
  saveLocalSyncFolderLabel,
  savingLocalSyncFolderLabel,
  exportLocalSyncLabel,
  exportingLocalSyncLabel,
  importLocalSyncLabel,
  importingLocalSyncLabel,
  onSaveLocalSyncFolder,
  onExportLocalSync,
  onImportLocalSync,
  loadingLocalSyncFolder = false,
  savingLocalSyncFolder = false,
  exportingLocalSync = false,
  importingLocalSync = false,
  deleteLabel,
  onImport,
  onExport,
  onRequestDelete,
  importing = false,
  exporting = false,
  disabled = false,
  disabledReason,
}: AccountDangerZoneViewProps) {
  const disabledReasonId = useId();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const showDisabledReason = disabled && disabledReason != null && disabledReason.trim().length > 0;
  const importDisabled = disabled || importing || exporting;
  const exportDisabled = disabled || importing || exporting;
  const hasLocalSyncControls =
    localSyncHeading &&
    localSyncFolderLabel &&
    onLocalSyncFolderChange &&
    saveLocalSyncFolderLabel &&
    exportLocalSyncLabel &&
    importLocalSyncLabel &&
    onSaveLocalSyncFolder &&
    onExportLocalSync &&
    onImportLocalSync;
  const localSyncBusy = loadingLocalSyncFolder || savingLocalSyncFolder || exportingLocalSync || importingLocalSync;
  const localSyncDisabled = disabled || localSyncBusy;
  const handleImportClick = () => {
    if (importDisabled) return;
    importInputRef.current?.click();
  };
  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file && !importDisabled) {
      onImport(file);
    }
  };

  return (
    <>
      <SettingsSection heading={dataHeading} surface="flat" className="mt-6" contentClassName="pt-1">
        {hasLocalSyncControls ? (
          <div className="mb-4 flex flex-col gap-3 rounded-md border border-border-subtle/70 p-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">{localSyncHeading}</h3>
              {localSyncDescription ? (
                <p className="mt-1 text-sm text-foreground-soft">{localSyncDescription}</p>
              ) : null}
            </div>
            <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
              {localSyncFolderLabel}
              <input
                value={localSyncFolderValue}
                placeholder={localSyncFolderPlaceholder}
                disabled={localSyncDisabled}
                onChange={(event) => onLocalSyncFolderChange(event.currentTarget.value)}
                className="h-9 rounded-md border border-input-border bg-input px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <SettingsLoadingActionButton
                onClick={onSaveLocalSyncFolder}
                loading={savingLocalSyncFolder}
                loadingLabel={savingLocalSyncFolderLabel}
                disabled={localSyncDisabled || localSyncFolderValue.trim().length === 0}
              >
                {saveLocalSyncFolderLabel}
              </SettingsLoadingActionButton>
              <SettingsLoadingActionButton
                onClick={onExportLocalSync}
                loading={exportingLocalSync}
                loadingLabel={exportingLocalSyncLabel}
                disabled={localSyncDisabled || localSyncFolderValue.trim().length === 0}
              >
                {exportLocalSyncLabel}
              </SettingsLoadingActionButton>
              <SettingsLoadingActionButton
                onClick={onImportLocalSync}
                loading={importingLocalSync}
                loadingLabel={importingLocalSyncLabel}
                disabled={localSyncDisabled || localSyncFolderValue.trim().length === 0}
              >
                {importLocalSyncLabel}
              </SettingsLoadingActionButton>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <input
            ref={importInputRef}
            data-testid="opml-import-input"
            type="file"
            accept=".opml,.xml"
            aria-label={importLabel}
            className="hidden"
            disabled={importDisabled}
            tabIndex={-1}
            onChange={handleImportFileChange}
          />
          <SettingsLoadingActionButton
            onClick={handleImportClick}
            loading={importing}
            loadingLabel={importingLabel}
            disabled={importDisabled}
          >
            {importLabel}
          </SettingsLoadingActionButton>
          <SettingsLoadingActionButton
            onClick={onExport}
            loading={exporting}
            loadingLabel={exportingLabel}
            disabled={exportDisabled}
          >
            {exportLabel}
          </SettingsLoadingActionButton>
        </div>
      </SettingsSection>

      <SettingsSection
        heading={dangerHeading}
        surface="flat"
        className="mt-3"
        headingClassName="text-state-danger-foreground/72"
        contentClassName="pt-1"
      >
        <DeleteButton
          onClick={onRequestDelete}
          disabled={disabled}
          aria-describedby={showDisabledReason ? disabledReasonId : undefined}
          className="w-full justify-center text-sm sm:w-auto"
        >
          {deleteLabel}
        </DeleteButton>
        {showDisabledReason ? (
          <p id={disabledReasonId} className="mt-2 max-w-[32rem] text-sm text-foreground-soft">
            {disabledReason}
          </p>
        ) : null}
      </SettingsSection>
    </>
  );
}
