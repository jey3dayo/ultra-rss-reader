import { type ChangeEvent, useId, useRef } from "react";
import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { DeleteButton, LabeledSwitchRow, SettingsInfoPopover } from "@/design-system";

type AccountDangerZoneViewProps = {
  dataHeading: string;
  dangerHeading: string;
  importLabel: string;
  importingLabel?: string;
  exportLabel: string;
  exportingLabel?: string;
  localSyncHeading?: string;
  localSyncSummary?: string;
  localSyncDescription?: string;
  localSyncInfoAriaLabel?: string;
  localSyncEnabledLabel?: string;
  localSyncEnabledDescription?: string;
  localSyncEnabledSummary?: string;
  localSyncEnabledInfoAriaLabel?: string;
  localSyncEnabledChecked?: boolean;
  onLocalSyncEnabledChange?: (checked: boolean) => void;
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

type LocalSyncEnabledToggle = {
  label: string;
  summary?: string;
  description?: string;
  infoAriaLabel?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

type LocalSyncControlsProps = {
  heading: string;
  summary?: string;
  description?: string;
  infoAriaLabel?: string;
  enabledToggle: LocalSyncEnabledToggle | null;
  folderLabel: string;
  folderPlaceholder?: string;
  folderValue: string;
  onFolderChange: (value: string) => void;
  saveLabel: string;
  savingLabel?: string;
  exportLabel: string;
  exportingLabel?: string;
  importLabel: string;
  importingLabel?: string;
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
  saving: boolean;
  exporting: boolean;
  importing: boolean;
  disabled: boolean;
};

function LocalSyncEnabledRow({ toggle, disabled }: { toggle: LocalSyncEnabledToggle; disabled: boolean }) {
  return (
    <div data-testid="local-sync-enabled-toggle">
      <LabeledSwitchRow
        label={toggle.label}
        description={toggle.summary}
        labelAccessory={
          toggle.description && toggle.infoAriaLabel ? (
            <SettingsInfoPopover title={toggle.label} content={toggle.description} ariaLabel={toggle.infoAriaLabel} />
          ) : undefined
        }
        checked={toggle.checked}
        onChange={toggle.onChange}
        disabled={disabled}
      />
    </div>
  );
}

function LocalSyncControls({
  heading,
  summary,
  description,
  infoAriaLabel,
  enabledToggle,
  folderLabel,
  folderPlaceholder,
  folderValue,
  onFolderChange,
  saveLabel,
  savingLabel,
  exportLabel,
  exportingLabel,
  importLabel,
  importingLabel,
  onSave,
  onExport,
  onImport,
  saving,
  exporting,
  importing,
  disabled,
}: LocalSyncControlsProps) {
  const actionDisabled = disabled || folderValue.trim().length === 0;
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-md border border-border-subtle/70 p-3">
      <div>
        <div className="flex items-center gap-1">
          <h3 className="text-sm font-semibold text-foreground">{heading}</h3>
          {description && infoAriaLabel ? (
            <SettingsInfoPopover title={heading} content={description} ariaLabel={infoAriaLabel} />
          ) : null}
        </div>
        {summary ? <p className="mt-1 text-sm text-foreground-soft">{summary}</p> : null}
      </div>
      {enabledToggle ? <LocalSyncEnabledRow toggle={enabledToggle} disabled={disabled} /> : null}
      <label className="flex flex-col gap-1 text-sm font-medium text-foreground">
        {folderLabel}
        <input
          value={folderValue}
          placeholder={folderPlaceholder}
          disabled={disabled}
          onChange={(event) => onFolderChange(event.currentTarget.value)}
          className="h-9 rounded-md border border-input-border bg-input px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <SettingsLoadingActionButton
          size="standalone"
          onClick={onSave}
          loading={saving}
          loadingLabel={savingLabel}
          disabled={actionDisabled}
        >
          {saveLabel}
        </SettingsLoadingActionButton>
        <SettingsLoadingActionButton
          size="standalone"
          onClick={onExport}
          loading={exporting}
          loadingLabel={exportingLabel}
          disabled={actionDisabled}
        >
          {exportLabel}
        </SettingsLoadingActionButton>
        <SettingsLoadingActionButton
          size="standalone"
          onClick={onImport}
          loading={importing}
          loadingLabel={importingLabel}
          disabled={actionDisabled}
        >
          {importLabel}
        </SettingsLoadingActionButton>
      </div>
    </div>
  );
}

export function AccountDangerZoneView({
  dataHeading,
  dangerHeading,
  importLabel,
  importingLabel,
  exportLabel,
  exportingLabel,
  localSyncHeading,
  localSyncSummary,
  localSyncDescription,
  localSyncInfoAriaLabel,
  localSyncEnabledLabel,
  localSyncEnabledDescription,
  localSyncEnabledSummary,
  localSyncEnabledInfoAriaLabel,
  localSyncEnabledChecked = true,
  onLocalSyncEnabledChange,
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
  const hasLocalSyncEnabledControl = localSyncEnabledLabel && onLocalSyncEnabledChange;
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
          <LocalSyncControls
            heading={localSyncHeading}
            summary={localSyncSummary}
            description={localSyncDescription}
            infoAriaLabel={localSyncInfoAriaLabel}
            enabledToggle={
              hasLocalSyncEnabledControl
                ? {
                    label: localSyncEnabledLabel,
                    summary: localSyncEnabledSummary,
                    description: localSyncEnabledDescription,
                    infoAriaLabel: localSyncEnabledInfoAriaLabel,
                    checked: localSyncEnabledChecked,
                    onChange: onLocalSyncEnabledChange,
                  }
                : null
            }
            folderLabel={localSyncFolderLabel}
            folderPlaceholder={localSyncFolderPlaceholder}
            folderValue={localSyncFolderValue}
            onFolderChange={onLocalSyncFolderChange}
            saveLabel={saveLocalSyncFolderLabel}
            savingLabel={savingLocalSyncFolderLabel}
            exportLabel={exportLocalSyncLabel}
            exportingLabel={exportingLocalSyncLabel}
            importLabel={importLocalSyncLabel}
            importingLabel={importingLocalSyncLabel}
            onSave={onSaveLocalSyncFolder}
            onExport={onExportLocalSync}
            onImport={onImportLocalSync}
            saving={savingLocalSyncFolder}
            exporting={exportingLocalSync}
            importing={importingLocalSync}
            disabled={localSyncDisabled}
          />
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
            size="standalone"
            onClick={handleImportClick}
            loading={importing}
            loadingLabel={importingLabel}
            disabled={importDisabled}
          >
            {importLabel}
          </SettingsLoadingActionButton>
          <SettingsLoadingActionButton
            size="standalone"
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
