import type { ComponentProps, ReactNode } from "react";
import { SettingsContentLayout } from "@/components/settings/shared/settings-content-layout";
import { SETTINGS_DETAIL_MAX_WIDTH_CLASS } from "@/components/settings/shared/settings-surface";
import { AccountDangerZoneView } from "./danger-zone-view";
import { AccountGeneralSectionView } from "./general-section-view";
import { AccountSyncSectionView } from "./sync-section-view";

export type AccountDetailViewProps = {
  title: string;
  subtitle?: string;
  generalSection: ComponentProps<typeof AccountGeneralSectionView>;
  credentialsSection?: ReactNode;
  syncSection: ComponentProps<typeof AccountSyncSectionView>;
  dangerZone: ComponentProps<typeof AccountDangerZoneView>;
  footer?: ReactNode;
};

export function AccountDetailView({
  title,
  subtitle,
  generalSection,
  credentialsSection,
  syncSection,
  dangerZone,
  footer,
}: AccountDetailViewProps) {
  return (
    <SettingsContentLayout
      title={title}
      subtitle={subtitle}
      footer={footer}
      titleLayout="stacked-left"
      maxWidthClassName={SETTINGS_DETAIL_MAX_WIDTH_CLASS}
      alignTitleToCardContent
      contentTestId="account-detail-layout"
    >
      <AccountGeneralSectionView {...generalSection} />
      {credentialsSection}
      <AccountSyncSectionView {...syncSection} />
      <AccountDangerZoneView {...dangerZone} />
    </SettingsContentLayout>
  );
}
