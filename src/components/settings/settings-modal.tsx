import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AccountDto } from "@/api/tauri-commands";
import { getPreferredAccountId } from "@/components/accounts/get-preferred-account-id";
import { AccountDetailView } from "@/components/settings/account-detail-view";
import { ActionsSettings } from "@/components/settings/actions-settings";
import { AddAccountForm } from "@/components/settings/add-account-form";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { DataSettings } from "@/components/settings/data-settings";
import { DebugSettings } from "@/components/settings/debug-settings";
import { GeneralSettings } from "@/components/settings/general-settings";
import { MuteSettings } from "@/components/settings/mute-settings";
import { ReadingSettings } from "@/components/settings/reading-settings";
import type { SettingsContentProps } from "@/components/settings/settings-modal.types";
import { SettingsModalView } from "@/components/settings/settings-modal-view";
import { ShortcutsSettings } from "@/components/settings/shortcuts-settings";
import { TagsSettings } from "@/components/settings/tags-settings";
import { useAccountDetailController } from "@/components/settings/use-account-detail-controller";
import { useAccountDetailSyncStatusRows } from "@/components/settings/use-account-detail-sync-status-rows";
import { useAccountDetailViewProps } from "@/components/settings/use-account-detail-view-props";
import { useSettingsModalViewProps } from "@/components/settings/use-settings-modal-view-props";
import { useAccountSyncStatus } from "@/hooks/use-account-sync-status";
import { useAccounts } from "@/hooks/use-accounts";
import { useScreenSnapshot } from "@/hooks/use-screen-snapshot";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";

function SnapshotBackedAccountDetail({
  account,
  onAccountDeleted,
}: {
  account: AccountDto;
  onAccountDeleted: (accountId: string) => void;
}) {
  const { t, i18n } = useTranslation("settings");
  const syncProgress = useUiStore((s) => s.syncProgress);
  const syncStatusQuery = useAccountSyncStatus(account.id);
  const controller = useAccountDetailController({
    account,
    t,
    onAccountDeleted: () => onAccountDeleted(account.id),
    onSyncStatusChanged: () => {
      void syncStatusQuery.refetch();
    },
  });
  const syncStatusRows = useAccountDetailSyncStatusRows({
    syncStatus: syncStatusQuery.data,
    language: i18n.language,
    t,
  });
  const isSyncing =
    syncProgress.active && (syncProgress.kind !== "manual_account" || syncProgress.activeAccountIds.has(account.id));
  const viewProps = useAccountDetailViewProps({
    account,
    controller,
    isSyncing,
    syncStatusRows,
    t,
  });

  return <AccountDetailView {...viewProps} />;
}

function SettingsContent({
  devBuild,
  settingsAddAccount,
  settingsCategory,
  selectedAccount,
  onAccountDeleted,
}: Omit<SettingsContentProps, "settingsAccountId"> & {
  devBuild: boolean;
  selectedAccount?: AccountDto;
  onAccountDeleted: (accountId: string) => void;
}) {
  if (selectedAccount) {
    return <SnapshotBackedAccountDetail account={selectedAccount} onAccountDeleted={onAccountDeleted} />;
  }
  if (settingsCategory === "accounts") {
    if (settingsAddAccount) {
      return <AddAccountForm />;
    }
    return null;
  }
  switch (settingsCategory) {
    case "appearance":
      return <AppearanceSettings />;
    case "reading":
      return <ReadingSettings />;
    case "mute":
      return <MuteSettings />;
    case "tags":
      return <TagsSettings />;
    case "shortcuts":
      return <ShortcutsSettings />;
    case "actions":
      return <ActionsSettings />;
    case "data":
      return <DataSettings />;
    case "debug":
      return devBuild ? <DebugSettings /> : <GeneralSettings />;
    default:
      return <GeneralSettings />;
  }
}

export function SettingsModal() {
  const { t } = useTranslation("settings");
  const devBuild = import.meta.env.DEV;
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const settingsCategory = useUiStore((s) => s.settingsCategory);
  const settingsAccountId = useUiStore((s) => s.settingsAccountId);
  const settingsAddAccount = useUiStore((s) => s.settingsAddAccount);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const openSettings = useUiStore((s) => s.openSettings);
  const setSettingsCategory = useUiStore((s) => s.setSettingsCategory);
  const setSettingsAccountId = useUiStore((s) => s.setSettingsAccountId);
  const setSettingsAddAccount = useUiStore((s) => s.setSettingsAddAccount);
  const settingsLoading = useUiStore((s) => s.settingsLoading);
  const [deletedAccountIds, setDeletedAccountIds] = useState<string[]>([]);
  const { data: accounts } = useAccounts();
  const savedAccountId = usePreferencesStore((s) => s.prefs.selected_account_id ?? "");
  const accountsSnapshotCandidate = accounts ?? null;
  const { snapshot: accountsSnapshot } = useScreenSnapshot(
    accountsSnapshotCandidate,
    accountsSnapshotCandidate !== null,
  );
  const visibleAccounts = (accountsSnapshot ?? accounts)?.filter((account) => !deletedAccountIds.includes(account.id));
  const hasSelectedVisibleAccount = settingsAccountId
    ? (visibleAccounts?.some((account) => account.id === settingsAccountId) ?? false)
    : false;
  const resolvedSettingsAccountId =
    settingsCategory !== "accounts" || settingsAddAccount || !visibleAccounts
      ? null
      : hasSelectedVisibleAccount
        ? settingsAccountId
        : getPreferredAccountId(visibleAccounts, savedAccountId);
  const selectedVisibleAccount =
    resolvedSettingsAccountId && visibleAccounts
      ? visibleAccounts.find((account) => account.id === resolvedSettingsAccountId)
      : undefined;

  useEffect(() => {
    if (deletedAccountIds.length === 0 || accounts === undefined) {
      return;
    }

    const liveAccountIds = new Set(accounts.map((account) => account.id));
    setDeletedAccountIds((current) => {
      const next = current.filter((accountId) => liveAccountIds.has(accountId));
      return next.length === current.length ? current : next;
    });
  }, [accounts, deletedAccountIds]);

  useEffect(() => {
    if (import.meta.env.DEV || settingsCategory !== "debug") {
      return;
    }

    setSettingsCategory("general");
  }, [setSettingsCategory, settingsCategory]);

  useEffect(() => {
    if (settingsCategory !== "accounts" || !visibleAccounts) {
      return;
    }

    if (settingsAccountId && !hasSelectedVisibleAccount) {
      if (resolvedSettingsAccountId) {
        if (settingsAddAccount) {
          setSettingsAddAccount(false);
        }
        setSettingsAccountId(resolvedSettingsAccountId);
      } else {
        setSettingsAccountId(null);
        setSettingsAddAccount(true);
      }
      return;
    }

    if (settingsAddAccount) {
      return;
    }

    if (resolvedSettingsAccountId) {
      if (settingsAccountId !== resolvedSettingsAccountId) {
        setSettingsAccountId(resolvedSettingsAccountId);
      }
      return;
    }

    if (settingsAccountId) {
      setSettingsAccountId(null);
    }
    if (!settingsAddAccount) {
      setSettingsAddAccount(true);
    }
  }, [
    settingsCategory,
    settingsAccountId,
    settingsAddAccount,
    visibleAccounts,
    hasSelectedVisibleAccount,
    resolvedSettingsAccountId,
    setSettingsAccountId,
    setSettingsAddAccount,
  ]);

  const handleAccountDeleted = (accountId: string) => {
    setDeletedAccountIds((current) => (current.includes(accountId) ? current : [...current, accountId]));
    setSettingsAccountId(null);
  };

  const viewProps = useSettingsModalViewProps({
    t,
    settingsOpen,
    settingsCategory,
    settingsAccountId,
    settingsAddAccount,
    settingsLoading,
    accounts: visibleAccounts,
    content: (
      <SettingsContent
        devBuild={devBuild}
        settingsAddAccount={settingsAddAccount}
        settingsCategory={settingsCategory}
        selectedAccount={selectedVisibleAccount}
        onAccountDeleted={handleAccountDeleted}
      />
    ),
    devBuild,
    closeSettings,
    openSettings,
    setSettingsCategory,
    setSettingsAccountId,
    setSettingsAddAccount,
  });

  return <SettingsModalView {...viewProps} />;
}
