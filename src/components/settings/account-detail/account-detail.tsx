import { useTranslation } from "react-i18next";
import { useAccountDetailController } from "@/components/settings/hooks/account-detail/use-account-detail-controller";
import { useAccountDetailSyncStatusRows } from "@/components/settings/hooks/account-detail/use-account-detail-sync-status-rows";
import { useAccountDetailViewProps } from "@/components/settings/hooks/account-detail/use-account-detail-view-props";
import { useAccountSyncStatus } from "@/hooks/use-account-sync-status";
import { useAccounts } from "@/hooks/use-accounts";
import type { AccountSetupSessionState } from "@/lib/account/account-setup-session.types";
import { useUiStore } from "@/stores/ui-store";
import type { AccountDetailAccount, AccountDetailSyncProgress } from "./types";
import { AccountDetailView } from "./view";

type AccountDetailContentProps = {
  account: AccountDetailAccount;
  isSyncing: boolean;
  syncProgress?: AccountDetailSyncProgress;
  accountSetupState: AccountSetupSessionState | null;
  accountSetupErrorMessage?: string | null;
};

function AccountDetailContent({
  account,
  isSyncing,
  syncProgress,
  accountSetupState,
  accountSetupErrorMessage,
}: AccountDetailContentProps) {
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
    accountSetupState,
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
    syncProgress: isSyncing ? syncProgress : undefined,
    syncStatus: syncStatusQuery.data,
    syncStatusRows,
    language: i18n.language,
    t,
    accountSetupState,
    accountSetupErrorMessage,
  });

  return <AccountDetailView {...viewProps} />;
}

export function AccountDetail() {
  const settingsAccountId = useUiStore((s) => s.settingsAccountId);
  const syncProgress = useUiStore((s) => s.syncProgress);
  const accountSetupSession = useUiStore((s) => s.accountSetupSession);
  const { data: accounts } = useAccounts();

  const account = accounts?.find((a) => a.id === settingsAccountId);

  if (!account) return null;

  const isSyncing =
    syncProgress.active && (syncProgress.kind !== "manual_account" || syncProgress.activeAccountIds.has(account.id));
  const accountSetupState =
    accountSetupSession && accountSetupSession.state !== "verifying" && accountSetupSession.accountId === account.id
      ? accountSetupSession.state
      : null;
  const accountSetupErrorMessage =
    accountSetupSession?.state === "failed" && accountSetupSession.accountId === account.id
      ? accountSetupSession.errorMessage
      : null;

  return (
    <AccountDetailContent
      account={account}
      isSyncing={isSyncing || accountSetupState === "syncing"}
      syncProgress={
        isSyncing || accountSetupState === "syncing"
          ? {
              total: syncProgress.total,
              completed: syncProgress.completed,
              currentAccountName: syncProgress.currentAccountName,
            }
          : undefined
      }
      accountSetupState={accountSetupState}
      accountSetupErrorMessage={accountSetupErrorMessage}
    />
  );
}
