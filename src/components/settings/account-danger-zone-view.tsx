import { DeleteButton } from "@/components/shared/delete-button";
import { Button } from "@/components/ui/button";
import type { AccountDangerZoneViewProps } from "./account-detail.types";
import { SettingsSection } from "./settings-section";

export function AccountDangerZoneView({
  dataHeading,
  dangerHeading,
  exportLabel,
  deleteLabel,
  onExport,
  onRequestDelete,
}: AccountDangerZoneViewProps) {
  return (
    <>
      <SettingsSection
        heading={dataHeading}
        className="mt-6 border-t border-border pt-6"
        contentClassName="pl-2 sm:pl-3"
      >
        <Button variant="outline" onClick={onExport} className="w-full justify-center text-sm sm:w-auto">
          {exportLabel}
        </Button>
      </SettingsSection>

      <SettingsSection
        heading={dangerHeading}
        className="mt-2 border-t border-border pt-6"
        headingClassName="text-state-danger-foreground/72"
        contentClassName="pl-2 sm:pl-3"
      >
        <DeleteButton onClick={onRequestDelete} className="w-full justify-center text-sm sm:w-auto">
          {deleteLabel}
        </DeleteButton>
      </SettingsSection>
    </>
  );
}
