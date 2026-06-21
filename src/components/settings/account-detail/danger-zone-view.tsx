import { type ChangeEvent, useId, useRef } from "react";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { DeleteButton } from "@/design-system";

type AccountDangerZoneViewProps = {
  dataHeading: string;
  dangerHeading: string;
  importLabel: string;
  exportLabel: string;
  deleteLabel: string;
  onImport: (file: File) => void;
  onExport: () => void;
  onRequestDelete: () => void;
  disabled?: boolean;
  disabledReason?: string;
};

export function AccountDangerZoneView({
  dataHeading,
  dangerHeading,
  importLabel,
  exportLabel,
  deleteLabel,
  onImport,
  onExport,
  onRequestDelete,
  disabled = false,
  disabledReason,
}: AccountDangerZoneViewProps) {
  const disabledReasonId = useId();
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const showDisabledReason = disabled && disabledReason != null && disabledReason.trim().length > 0;
  const handleImportClick = () => {
    importInputRef.current?.click();
  };
  const handleImportFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) {
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
            tabIndex={-1}
            onChange={handleImportFileChange}
          />
          <SettingsActionButton onClick={handleImportClick} disabled={disabled}>
            {importLabel}
          </SettingsActionButton>
          <SettingsActionButton onClick={onExport} disabled={disabled}>
            {exportLabel}
          </SettingsActionButton>
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
