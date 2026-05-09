import type { ComponentProps, ReactNode } from "react";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { AccountDangerZoneView } from "./danger-zone-view";
import { AccountGeneralSectionView } from "./general-section-view";
import { AccountSyncSectionView } from "./sync-section-view";

export type AccountDetailViewProps = {
  title: string;
  subtitle?: string;
  headerSummary?: ReactNode;
  generalSection: ComponentProps<typeof AccountGeneralSectionView>;
  credentialsSection?: ReactNode;
  syncSection: ComponentProps<typeof AccountSyncSectionView>;
  dangerZone: ComponentProps<typeof AccountDangerZoneView>;
};

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
