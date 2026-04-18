import { useTranslation } from "react-i18next";
import type { AccountDetailContentProps } from "@/components/settings/account-detail.types";
import { AccountDetailView } from "@/components/settings/account-detail-view";
import { useAccountDetailController } from "@/components/settings/use-account-detail-controller";
import { useAccountDetailSyncStatusRows } from "@/components/settings/use-account-detail-sync-status-rows";
import { useAccountDetailViewProps } from "@/components/settings/use-account-detail-view-props";
import { useAccountSyncStatus } from "@/hooks/use-account-sync-status";
import { useAccounts } from "@/hooks/use-accounts";
import { useUiStore } from "@/stores/ui-store";

function AccountDetailContent({ account, isSyncing }: AccountDetailContentProps) {
  const { t, i18n } = useTranslation("settings");
  const syncStatusQuery = useAccountSyncStatus(account.id);
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const controller = useAccountDetailController({
    account,
    t,
    onAccountDeleted: () => setSettingsAccountId(null),
    onSyncStatusChanged: () => {
      void syncStatusQuery.refetch();
    },
  });

  const syncStatusRows = useAccountDetailSyncStatusRows({
    syncStatus: syncStatusQuery.data,
    language: i18n.language,
    t,
  });

  const viewProps = useAccountDetailViewProps({
    account,
    controller,
    isSyncing,
    syncStatus: syncStatusQuery.data,
    syncStatusRows,
    language: i18n.language,
    t,
  });

  return <AccountDetailView {...viewProps} />;
}

export function AccountDetail() {
  const settingsAccountId = useUiStore((s) => s.settingsAccountId);
  const syncProgress = useUiStore((s) => s.syncProgress);
  const { data: accounts } = useAccounts();

  const account = accounts?.find((a) => a.id === settingsAccountId);

  if (!account) return null;

  const isSyncing =
    syncProgress.active && (syncProgress.kind !== "manual_account" || syncProgress.activeAccountIds.has(account.id));

  return <AccountDetailContent account={account} isSyncing={isSyncing} />;
}
