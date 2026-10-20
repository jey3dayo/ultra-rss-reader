import type { TFunction } from "i18next";
import type { AccountDto } from "@/api/tauri-commands";
import { getPreferredAccountId } from "@/lib/account/account-selection";
import type { AccountSetupSession } from "@/lib/account/account-setup-session.types";
import type { SettingsCategory } from "@/lib/settings/settings-category.types";
import type { SettingsDirtyStateSnapshot } from "@/lib/settings/settings-dirty-state-registry";

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

export function getSettingsAccountsViewTransition({
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

export function getVisibleAccounts(
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

export function getActiveSetupAccountId(accountSetupSession: AccountSetupSession | null): string | null {
  if (accountSetupSession?.state === "syncing" || accountSetupSession?.state === "failed") {
    return accountSetupSession.accountId;
  }

  return null;
}

export function getSetupVisibleAccount(
  activeSetupAccountId: string | null,
  visibleAccounts: AccountDto[] | undefined,
): AccountDto | undefined {
  if (!activeSetupAccountId || !visibleAccounts) {
    return undefined;
  }

  return visibleAccounts.find((account) => account.id === activeSetupAccountId);
}

export function getHasSelectedVisibleAccount(
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

export function getResolvedSettingsAccountId({
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

export function getSelectedVisibleAccount(
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

export function getIsSetupLocked({
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

export function getPendingSaveLockReason(
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
