import type { AccountDetailViewProps } from "@/components/settings/account-detail/types";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { AccountDangerZoneView } from "./danger-zone-view";
import { AccountGeneralSectionView } from "./general-section-view";
import { AccountSyncSectionView } from "./sync-section-view";

export function AccountDetailView({
  title,
  subtitle,
  headerSummary,
  generalSection,
  credentialsSection,
  syncSection,
  dangerZone,
}: AccountDetailViewProps) {
  return (
    <SettingsContentLayout
      title={title}
      subtitle={subtitle}
      headerSummary={headerSummary}
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
