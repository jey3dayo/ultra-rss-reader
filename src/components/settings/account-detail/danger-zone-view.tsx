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
      <SettingsSection
        heading={dataHeading}
        className="mt-6 border-t border-border pt-6"
        contentClassName="pl-2 sm:pl-3"
      >
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
        className="mt-2 border-t border-border pt-6"
        headingClassName="text-state-danger-foreground/72"
        contentClassName="pl-2 sm:pl-3"
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
          <p id={disabledReasonId} className="mt-2 max-w-[32rem] font-serif text-sm text-foreground-soft">
            {disabledReason}
          </p>
        ) : null}
      </SettingsSection>
    </>
  );
}
