import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { DeleteButton } from "@/components/shared/delete-button";

type AccountDangerZoneViewProps = {
  dataHeading: string;
  dangerHeading: string;
  exportLabel: string;
  deleteLabel: string;
  onExport: () => void;
  onRequestDelete: () => void;
  disabled?: boolean;
};

export function AccountDangerZoneView({
  dataHeading,
  dangerHeading,
  exportLabel,
  deleteLabel,
  onExport,
  onRequestDelete,
  disabled = false,
}: AccountDangerZoneViewProps) {
  return (
    <>
      <SettingsSection
        heading={dataHeading}
        className="mt-6 border-t border-border pt-6"
        contentClassName="pl-2 sm:pl-3"
      >
        <SettingsActionButton onClick={onExport} disabled={disabled}>
          {exportLabel}
        </SettingsActionButton>
      </SettingsSection>

      <SettingsSection
        heading={dangerHeading}
        className="mt-2 border-t border-border pt-6"
        headingClassName="text-state-danger-foreground/72"
        contentClassName="pl-2 sm:pl-3"
      >
        <DeleteButton onClick={onRequestDelete} disabled={disabled} className="w-full justify-center text-sm sm:w-auto">
          {deleteLabel}
        </DeleteButton>
      </SettingsSection>
    </>
  );
}
