import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AccountDto } from "@/api/tauri-commands";
import { AccountDetailView } from "@/components/settings/account-detail-view";
import { ActionsSettings } from "@/components/settings/actions-settings";
import { AddAccountForm } from "@/components/settings/add-account-form";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { DataSettings } from "@/components/settings/data-settings";
import { DebugSettings } from "@/components/settings/debug-settings";
import { GeneralSettings } from "@/components/settings/general-settings";
import { useAccountDetailController } from "@/components/settings/hooks/account-detail/use-account-detail-controller";
import { useAccountDetailSyncStatusRows } from "@/components/settings/hooks/account-detail/use-account-detail-sync-status-rows";
import { useAccountDetailViewProps } from "@/components/settings/hooks/account-detail/use-account-detail-view-props";
import { useSettingsModalViewProps } from "@/components/settings/hooks/use-settings-modal-view-props";
import { MuteSettings } from "@/components/settings/mute-settings";
import { ReadingSettings } from "@/components/settings/reading-settings";
import { SettingsModalView } from "@/components/settings/settings-modal-view";
import { ShortcutsSettings } from "@/components/settings/shortcuts-settings";
import { TagsSettings } from "@/components/settings/tags-settings";
import { useAccountSyncStatus } from "@/hooks/use-account-sync-status";
import { useAccounts } from "@/hooks/use-accounts";
import { useScreenSnapshot } from "@/hooks/use-screen-snapshot";
import { getPreferredAccountId } from "@/lib/account/account-selection";
import type { AddAccountProviderKind } from "@/lib/account/add-account-form";
import type { SettingsCategory } from "@/lib/settings/settings-category.types";
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
    syncStatus: syncStatusQuery.data,
    syncStatusRows,
    language: i18n.language,
    t,
  });

  return <AccountDetailView {...viewProps} />;
}

type SettingsContentProps = {
  devBuild: boolean;
  settingsAddAccount: boolean;
  settingsAddAccountInitialKind: AddAccountProviderKind | null;
  settingsCategory: SettingsCategory;
  selectedAccount?: AccountDto;
  onAccountDeleted: (accountId: string) => void;
};

type SettingsAccountsTransitionParams = {
  activeSetupAccountId: string | null;
  hasSelectedVisibleAccount: boolean;
  resolvedSettingsAccountId: string | null;
  settingsAccountId: string | null;
  settingsAddAccount: boolean;
  settingsCategory: SettingsCategory;
  visibleAccounts: AccountDto[] | undefined;
};

type SettingsAccountsViewTransition = {
  accountId: string | null;
  addAccount: boolean;
} | null;

function getSettingsAccountsViewTransition({
  activeSetupAccountId,
  hasSelectedVisibleAccount,
  resolvedSettingsAccountId,
  settingsAccountId,
  settingsAddAccount,
  settingsCategory,
  visibleAccounts,
}: SettingsAccountsTransitionParams): SettingsAccountsViewTransition {
  if (settingsCategory !== "accounts" || !visibleAccounts) {
    return null;
  }

  if (activeSetupAccountId) {
    return settingsAccountId !== activeSetupAccountId || settingsAddAccount
      ? { accountId: activeSetupAccountId, addAccount: false }
      : null;
  }

  if (settingsAccountId && !hasSelectedVisibleAccount) {
    return resolvedSettingsAccountId
      ? { accountId: resolvedSettingsAccountId, addAccount: false }
      : { accountId: null, addAccount: true };
  }

  if (settingsAddAccount) {
    return null;
  }

  if (resolvedSettingsAccountId) {
    return settingsAccountId !== resolvedSettingsAccountId
      ? { accountId: resolvedSettingsAccountId, addAccount: false }
      : null;
  }

  return { accountId: null, addAccount: true };
}

function SettingsContent({
  devBuild,
  settingsAddAccount,
  settingsAddAccountInitialKind,
  settingsCategory,
  selectedAccount,
  onAccountDeleted,
}: SettingsContentProps) {
  if (selectedAccount) {
    return <SnapshotBackedAccountDetail account={selectedAccount} onAccountDeleted={onAccountDeleted} />;
  }
  if (settingsCategory === "accounts") {
    if (settingsAddAccount) {
      return <AddAccountForm initialKind={settingsAddAccountInitialKind ?? undefined} />;
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
  const settingsAddAccountInitialKind = useUiStore((s) => s.settingsAddAccountInitialKind);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const openSettings = useUiStore((s) => s.openSettings);
  const setSettingsCategory = useUiStore((s) => s.setSettingsCategory);
  const openSettingsAccount = useUiStore((s) => s.openSettingsAccount);
  const openSettingsAddAccount = useUiStore((s) => s.openSettingsAddAccount);
  const setSettingsAccountsView = useUiStore((s) => s.setSettingsAccountsView);
  const settingsLoading = useUiStore((s) => s.settingsLoading);
  const accountSetupSession = useUiStore((s) => s.accountSetupSession);
  const [deletedAccountIds, setDeletedAccountIds] = useState<string[]>([]);
  const { data: accounts } = useAccounts();
  const savedAccountId = usePreferencesStore((s) => s.prefs.selected_account_id ?? "");
  const accountsSnapshotCandidate = accounts ?? null;
  const { snapshot: accountsSnapshot } = useScreenSnapshot(
    accountsSnapshotCandidate,
    accountsSnapshotCandidate !== null,
  );
  const visibleAccounts = (accountsSnapshot ?? accounts)?.filter((account) => !deletedAccountIds.includes(account.id));
  const activeSetupAccountId =
    accountSetupSession !== null &&
    accountSetupSession.state !== "verifying" &&
    (accountSetupSession.state === "syncing" || accountSetupSession.state === "failed")
      ? accountSetupSession.accountId
      : null;
  const setupVisibleAccount =
    activeSetupAccountId && visibleAccounts
      ? visibleAccounts.find((account) => account.id === activeSetupAccountId)
      : undefined;
  const hasSelectedVisibleAccount = settingsAccountId
    ? (visibleAccounts?.some((account) => account.id === settingsAccountId) ?? false)
    : false;
  const resolvedSettingsAccountId =
    settingsCategory !== "accounts" || settingsAddAccount || !visibleAccounts
      ? null
      : activeSetupAccountId && setupVisibleAccount
        ? activeSetupAccountId
        : hasSelectedVisibleAccount
          ? settingsAccountId
          : getPreferredAccountId(visibleAccounts, savedAccountId);
  const selectedVisibleAccount =
    setupVisibleAccount ??
    (resolvedSettingsAccountId && visibleAccounts
      ? visibleAccounts.find((account) => account.id === resolvedSettingsAccountId)
      : undefined);
  const isSetupLocked =
    accountSetupSession !== null &&
    (accountSetupSession.state === "verifying"
      ? settingsCategory === "accounts" && settingsAddAccount
      : (accountSetupSession.state === "syncing" || accountSetupSession.state === "failed") &&
        (selectedVisibleAccount?.id === accountSetupSession.accountId ||
          settingsAccountId === accountSetupSession.accountId));
  const settingsAccountsViewTransition = getSettingsAccountsViewTransition({
    activeSetupAccountId,
    hasSelectedVisibleAccount,
    resolvedSettingsAccountId,
    settingsAccountId,
    settingsAddAccount,
    settingsCategory,
    visibleAccounts,
  });
  const transitionAccountId = settingsAccountsViewTransition?.accountId;
  const transitionAddAccount = settingsAccountsViewTransition?.addAccount;

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
    if (transitionAddAccount === undefined) {
      return;
    }

    setSettingsAccountsView(transitionAccountId ?? null, transitionAddAccount);
  }, [transitionAccountId, transitionAddAccount, setSettingsAccountsView]);

  const handleAccountDeleted = (accountId: string) => {
    setDeletedAccountIds((current) => (current.includes(accountId) ? current : [...current, accountId]));
    setSettingsAccountsView(null, false);
  };

  const viewProps = useSettingsModalViewProps({
    t,
    settingsOpen,
    settingsCategory,
    settingsAccountId,
    settingsAddAccount,
    settingsAddAccountInitialKind,
    settingsLoading,
    accounts: visibleAccounts,
    content: (
      <SettingsContent
        devBuild={devBuild}
        settingsAddAccount={settingsAddAccount}
        settingsAddAccountInitialKind={settingsAddAccountInitialKind}
        settingsCategory={settingsCategory}
        selectedAccount={selectedVisibleAccount}
        onAccountDeleted={handleAccountDeleted}
      />
    ),
    devBuild,
    closeSettings,
    openSettings,
    setSettingsCategory,
    openSettingsAccount,
    openSettingsAddAccount,
    setupLockReason: isSetupLocked ? t("account.setup_lock_reason") : null,
  });

  return <SettingsModalView {...viewProps} />;
}
