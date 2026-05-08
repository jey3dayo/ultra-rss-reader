import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { DeleteButton } from "@/components/shared/delete-button";
import type { AccountDangerZoneViewProps } from "./account-detail/types";
import { SettingsSection } from "./shared/settings-section";

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
