import type { TFunction } from "i18next";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AccountDto } from "@/api/tauri-commands";
import { refetchAccountSyncStatusWithErrorSurface } from "@/components/settings/account-detail/sync-status-refetch";
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
import {
  discardDirtySettingsEntries,
  saveDirtySettingsEntries,
} from "@/components/settings/hooks/settings-dirty-state-registry";
import {
  SettingsDirtyStateRegistryProvider,
  useRegisterSettingsDirtyState,
  useSettingsDirtyStateRegistrySnapshot,
} from "@/components/settings/hooks/use-settings-dirty-state-registry";
import { useSettingsModalViewProps } from "@/components/settings/hooks/use-settings-modal-view-props";
import { MuteSettings } from "@/components/settings/mute-settings";
import { ReadingSettings } from "@/components/settings/reading-settings";
import { SettingsModalView } from "@/components/settings/settings-modal-view";
import { SettingsUnsavedChangesFooter } from "@/components/settings/settings-unsaved-changes-bar";
import { SettingsUnsavedChangesDialog } from "@/components/settings/settings-unsaved-changes-dialog";
import { ShortcutsSettings } from "@/components/settings/shortcuts-settings";
import { TagsSettings } from "@/components/settings/tags-settings";
import { useAccountSyncStatus } from "@/hooks/use-account-sync-status";
import { useAccounts } from "@/hooks/use-accounts";
import { useScreenSnapshot } from "@/hooks/use-screen-snapshot";
import { getPreferredAccountId } from "@/lib/account/account-selection";
import type { AccountSetupSession } from "@/lib/account/account-setup-session.types";
import type { AddAccountProviderKind } from "@/lib/account/add-account-form";
import { useStableOpenTranslation } from "@/lib/i18n/use-stable-open-translation";
import type { SettingsCategory } from "@/lib/settings/settings-category.types";
import type { SettingsDirtyStateSnapshot } from "@/lib/settings/settings-dirty-state-registry";
import { usePlatformStore } from "@/stores/platform-store";
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
  const loadPlatformInfo = usePlatformStore((s) => s.loadPlatformInfo);
  const platformLoaded = usePlatformStore((s) => s.loaded);
  const platformLoadError = usePlatformStore((s) => s.loadError);
  const usesDevFileCredentials = usePlatformStore((s) => s.platform.capabilities.uses_dev_file_credentials);

  useEffect(() => {
    void loadPlatformInfo();
  }, [loadPlatformInfo]);

  const controller = useAccountDetailController({
    account,
    t,
    onAccountDeleted: () => onAccountDeleted(account.id),
    onSyncStatusChanged: () => {
      refetchAccountSyncStatusWithErrorSurface(syncStatusQuery.refetch);
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
    canRecoverDevCredentialsStore: platformLoaded && !platformLoadError && usesDevFileCredentials,
  });

  return <AccountDetailView {...viewProps} />;
}

type SettingsContentProps = {
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

function getVisibleAccounts(
  accounts: AccountDto[] | undefined,
  accountsSnapshot: AccountDto[] | null,
  deletedAccountIds: string[],
): AccountDto[] | undefined {
  const hiddenAccountIds = new Set(deletedAccountIds);
  if (accounts && accountsSnapshot) {
    const liveAccountIds = new Set(accounts.map((account) => account.id));
    for (const snapshotAccount of accountsSnapshot) {
      if (!liveAccountIds.has(snapshotAccount.id)) {
        hiddenAccountIds.add(snapshotAccount.id);
      }
    }
  }

  return (accountsSnapshot ?? accounts)?.filter((account) => !hiddenAccountIds.has(account.id));
}

function getActiveSetupAccountId(accountSetupSession: AccountSetupSession | null): string | null {
  if (accountSetupSession?.state === "syncing" || accountSetupSession?.state === "failed") {
    return accountSetupSession.accountId;
  }

  return null;
}

function getSetupVisibleAccount(
  activeSetupAccountId: string | null,
  visibleAccounts: AccountDto[] | undefined,
): AccountDto | undefined {
  if (!activeSetupAccountId || !visibleAccounts) {
    return undefined;
  }

  return visibleAccounts.find((account) => account.id === activeSetupAccountId);
}

function getHasSelectedVisibleAccount(
  settingsAccountId: string | null,
  visibleAccounts: AccountDto[] | undefined,
): boolean {
  if (!settingsAccountId) {
    return false;
  }

  return visibleAccounts?.some((account) => account.id === settingsAccountId) ?? false;
}

type ResolveSettingsAccountIdParams = {
  settingsCategory: SettingsCategory;
  settingsAddAccount: boolean;
  visibleAccounts: AccountDto[] | undefined;
  activeSetupAccountId: string | null;
  setupVisibleAccount: AccountDto | undefined;
  hasSelectedVisibleAccount: boolean;
  settingsAccountId: string | null;
  savedAccountId: string;
};

function getResolvedSettingsAccountId({
  settingsCategory,
  settingsAddAccount,
  visibleAccounts,
  activeSetupAccountId,
  setupVisibleAccount,
  hasSelectedVisibleAccount,
  settingsAccountId,
  savedAccountId,
}: ResolveSettingsAccountIdParams): string | null {
  if (settingsCategory !== "accounts" || settingsAddAccount || !visibleAccounts) {
    return null;
  }
  if (activeSetupAccountId && setupVisibleAccount) {
    return activeSetupAccountId;
  }
  if (hasSelectedVisibleAccount) {
    return settingsAccountId;
  }

  return getPreferredAccountId(visibleAccounts, savedAccountId);
}

function getSelectedVisibleAccount(
  setupVisibleAccount: AccountDto | undefined,
  resolvedSettingsAccountId: string | null,
  visibleAccounts: AccountDto[] | undefined,
): AccountDto | undefined {
  if (setupVisibleAccount) {
    return setupVisibleAccount;
  }
  if (!resolvedSettingsAccountId || !visibleAccounts) {
    return undefined;
  }

  return visibleAccounts.find((account) => account.id === resolvedSettingsAccountId);
}

type SettingsSetupLockParams = {
  accountSetupSession: AccountSetupSession | null;
  settingsCategory: SettingsCategory;
  settingsAddAccount: boolean;
  selectedVisibleAccount: AccountDto | undefined;
  settingsAccountId: string | null;
};

function getIsSetupLocked({
  accountSetupSession,
  settingsCategory,
  settingsAddAccount,
  selectedVisibleAccount,
  settingsAccountId,
}: SettingsSetupLockParams): boolean {
  if (accountSetupSession === null) {
    return false;
  }
  if (accountSetupSession.state === "verifying") {
    return settingsCategory === "accounts" && settingsAddAccount;
  }

  return (
    (accountSetupSession.state === "syncing" || accountSetupSession.state === "failed") &&
    (selectedVisibleAccount?.id === accountSetupSession.accountId ||
      settingsAccountId === accountSetupSession.accountId)
  );
}

function getPendingSaveLockReason(
  dirtyStateSnapshot: SettingsDirtyStateSnapshot,
  t: TFunction<"settings">,
): string | null {
  if (dirtyStateSnapshot.pending) {
    return t("dirty_state.pending_lock_message", {
      defaultValue: "Saving changes. Please wait before leaving settings.",
    });
  }

  return null;
}

function SettingsContent({
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
      return <DebugSettings />;
    default:
      return <GeneralSettings />;
  }
}

export function SettingsModal() {
  return (
    <SettingsDirtyStateRegistryProvider>
      <SettingsModalContent />
    </SettingsDirtyStateRegistryProvider>
  );
}

function SettingsModalContent() {
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const t = useStableOpenTranslation("settings", settingsOpen);
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
  const pendingPreferenceSaves = usePreferencesStore((s) => s.pendingPreferenceSaves);
  const [deletedAccountIds, setDeletedAccountIds] = useState<string[]>([]);
  const { data: accounts } = useAccounts();
  const savedAccountId = usePreferencesStore((s) => s.prefs.selected_account_id ?? "");
  const accountsSnapshotCandidate = accounts ?? null;
  const { snapshot: accountsSnapshot } = useScreenSnapshot(
    accountsSnapshotCandidate,
    accountsSnapshotCandidate !== null,
  );
  const visibleAccounts = getVisibleAccounts(accounts, accountsSnapshot, deletedAccountIds);
  const activeSetupAccountId = getActiveSetupAccountId(accountSetupSession);
  const setupVisibleAccount = getSetupVisibleAccount(activeSetupAccountId, visibleAccounts);
  const hasSelectedVisibleAccount = getHasSelectedVisibleAccount(settingsAccountId, visibleAccounts);
  const resolvedSettingsAccountId = getResolvedSettingsAccountId({
    settingsCategory,
    settingsAddAccount,
    visibleAccounts,
    activeSetupAccountId,
    setupVisibleAccount,
    hasSelectedVisibleAccount,
    settingsAccountId,
    savedAccountId,
  });
  const selectedVisibleAccount = getSelectedVisibleAccount(
    setupVisibleAccount,
    resolvedSettingsAccountId,
    visibleAccounts,
  );
  const isSetupLocked = getIsSetupLocked({
    accountSetupSession,
    settingsCategory,
    settingsAddAccount,
    selectedVisibleAccount,
    settingsAccountId,
  });
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
  const dirtyStateSnapshot = useSettingsDirtyStateRegistrySnapshot();
  useRegisterSettingsDirtyState({
    owner: "preferences",
    dirty: false,
    pending: pendingPreferenceSaves > 0,
    blockingReason: pendingPreferenceSaves > 0 ? "preferences-save-pending" : null,
  });
  const dirtyStateLockReason = getPendingSaveLockReason(dirtyStateSnapshot, t);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const [savingBeforeLeave, setSavingBeforeLeave] = useState(false);
  const guardLeave = (leave: () => void) => {
    if (!dirtyStateSnapshot.dirty) {
      leave();
      return;
    }
    setPendingLeave(() => leave);
  };

  const handleLeaveSave = async () => {
    const leave = pendingLeave;
    if (leave === null) {
      return;
    }
    setSavingBeforeLeave(true);
    try {
      const saved = await saveDirtySettingsEntries(dirtyStateSnapshot);
      setPendingLeave(null);
      if (saved) {
        leave();
      }
    } finally {
      setSavingBeforeLeave(false);
    }
  };

  const handleLeaveDiscard = () => {
    const leave = pendingLeave;
    setPendingLeave(null);
    discardDirtySettingsEntries(dirtyStateSnapshot);
    leave?.();
  };

  const handleLeaveCancel = () => {
    if (!savingBeforeLeave) {
      setPendingLeave(null);
    }
  };

  const leaveConfirmation = (
    <SettingsUnsavedChangesDialog
      open={pendingLeave !== null}
      title={t("dirty_state.confirm_title")}
      message={t("dirty_state.confirm_message")}
      saveLabel={t("dirty_state.save")}
      savingLabel={t("account.testing_connection")}
      discardLabel={t("dirty_state.discard")}
      cancelLabel={t("dirty_state.cancel")}
      saving={savingBeforeLeave}
      onSave={() => void handleLeaveSave()}
      onDiscard={handleLeaveDiscard}
      onCancel={handleLeaveCancel}
    />
  );
  const footer = (
    <SettingsUnsavedChangesFooter
      message={t("dirty_state.unsaved_changes")}
      discardLabel={t("dirty_state.discard")}
      saveLabel={t("account.save_and_test_connection")}
      savingLabel={t("account.testing_connection")}
    />
  );

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
        settingsAddAccount={settingsAddAccount}
        settingsAddAccountInitialKind={settingsAddAccountInitialKind}
        settingsCategory={settingsCategory}
        selectedAccount={selectedVisibleAccount}
        onAccountDeleted={handleAccountDeleted}
      />
    ),
    footer,
    guardLeave,
    leaveConfirmation,
    closeSettings,
    openSettings,
    setSettingsCategory,
    openSettingsAccount,
    openSettingsAddAccount,
    setupLockReason: isSetupLocked ? t("account.setup_lock_reason") : dirtyStateLockReason,
  });

  return <SettingsModalView {...viewProps} />;
}
