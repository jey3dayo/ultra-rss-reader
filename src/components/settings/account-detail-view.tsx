import { AccountDangerZoneView } from "@/components/settings/account-danger-zone-view";
import type { AccountDetailViewProps } from "@/components/settings/account-detail.types";
import { AccountGeneralSectionView } from "@/components/settings/account-general-section-view";
import { AccountSyncSectionView } from "@/components/settings/account-sync-section-view";
import { SettingsContentLayout } from "@/components/settings/settings-content-layout";

export function AccountDetailView({
  title,
  subtitle,
  generalSection,
  credentialsSection,
  syncSection,
  dangerZone,
}: AccountDetailViewProps) {
  return (
    <SettingsContentLayout
      title={title}
      subtitle={subtitle}
      titleLayout="stacked-left"
      maxWidthClassName="max-w-[640px]"
      contentTestId="account-detail-layout"
    >
      <AccountGeneralSectionView {...generalSection} />
      {credentialsSection}
      <AccountSyncSectionView {...syncSection} />
      <AccountDangerZoneView {...dangerZone} />
    </SettingsContentLayout>
  );
}
