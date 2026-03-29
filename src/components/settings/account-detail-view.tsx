import type { ReactNode } from "react";
import { AccountDangerZoneView, type AccountDangerZoneViewProps } from "@/components/settings/account-danger-zone-view";
import {
  AccountGeneralSectionView,
  type AccountGeneralSectionViewProps,
} from "@/components/settings/account-general-section-view";
import {
  AccountSyncSectionView,
  type AccountSyncSectionViewProps,
} from "@/components/settings/account-sync-section-view";

export type AccountDetailViewProps = {
  title: string;
  subtitle: string;
  generalSection: AccountGeneralSectionViewProps;
  credentialsSection?: ReactNode;
  syncSection: AccountSyncSectionViewProps;
  dangerZone: AccountDangerZoneViewProps;
};

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
      <p className="mb-6 text-center text-sm text-muted-foreground">{subtitle}</p>

      <AccountGeneralSectionView {...generalSection} />
      {credentialsSection}
      <AccountSyncSectionView {...syncSection} />
      <AccountDangerZoneView {...dangerZone} />
    </div>
  );
}
