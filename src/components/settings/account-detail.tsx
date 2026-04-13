import { useTranslation } from "react-i18next";
import type { AccountDetailContentProps, AccountSyncStatusRow } from "@/components/settings/account-detail.types";
import { AccountDetailView } from "@/components/settings/account-detail-view";
import { useAccountDetailController } from "@/components/settings/use-account-detail-controller";
import { useAccountDetailViewProps } from "@/components/settings/use-account-detail-view-props";
import { useAccountSyncStatus } from "@/hooks/use-account-sync-status";
import { useAccounts } from "@/hooks/use-accounts";
import { formatAccountSyncRetryDateTime } from "@/lib/account-sync-status-format";
import { useUiStore } from "@/stores/ui-store";

function AccountDetailContent({ account, isSyncing }: AccountDetailContentProps) {
  const { t, i18n } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
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

  const syncStatusRows = (() => {
    const syncStatus = syncStatusQuery.data;
    if (!syncStatus) {
      return [];
    }

    const rows: AccountSyncStatusRow[] = [];
    if (syncStatus.next_retry_at) {
      const formattedRetryAt = formatAccountSyncRetryDateTime(syncStatus.next_retry_at, i18n.language);
      rows.push({ label: t("account.next_automatic_retry"), value: formattedRetryAt ?? syncStatus.next_retry_at });
    }
    if (syncStatus.error_count > 0) {
      rows.push({
        label: t("account.consecutive_sync_failures"),
        value: t("account.consecutive_sync_failures_value", { count: syncStatus.error_count }),
      });
    }
    if (syncStatus.last_error) {
      rows.push({ label: t("account.last_sync_error"), value: syncStatus.last_error });
    }
    return rows;
  })();

  const viewProps = useAccountDetailViewProps({
    account,
    controller,
    isSyncing,
    syncStatusRows,
    t,
    tc,
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
