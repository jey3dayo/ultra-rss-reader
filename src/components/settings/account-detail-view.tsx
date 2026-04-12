import { AccountDangerZoneView } from "@/components/settings/account-danger-zone-view";
import type { AccountDetailViewProps } from "@/components/settings/account-detail.types";
import { AccountGeneralSectionView } from "@/components/settings/account-general-section-view";
import { AccountSyncSectionView } from "@/components/settings/account-sync-section-view";

export function AccountDetailView({
  title,
  subtitle,
  generalSection,
  credentialsSection,
  syncSection,
  dangerZone,
}: AccountDetailViewProps) {
  return (
    <div className="p-6">
      <h2 className="mb-2 text-center text-lg font-semibold">{title}</h2>
      {subtitle ? <p className="mb-6 text-center text-sm text-muted-foreground">{subtitle}</p> : null}

      <AccountGeneralSectionView {...generalSection} />
      {credentialsSection}
      <AccountSyncSectionView {...syncSection} />
      <AccountDangerZoneView {...dangerZone} />
    </div>
  );
}
