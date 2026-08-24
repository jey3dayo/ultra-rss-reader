import type { QueryClient } from "@tanstack/react-query";
import { resolveRestoredAccountSelection } from "@/lib/account/account-selection";
import {
  DATABASE_RESTORE_STORAGE_RECONCILIATION_POLICY,
  type DatabaseRestoreStorageReconciliationPolicy,
} from "@/schemas/storage";

/**
 * Database restore replaces the native source of truth while the current
 * renderer still holds cache, storage, and selection state from the previous
 * database. These pieces are reconciled together so the settings action can
 * expose one stable post-restore contract to its callers.
 * The same boundary also serves the private-data reset path.
 *
 * The feature owns the lifecycle callbacks passed into this boundary. This
 * module owns only the ordering and result shape of the frontend reset.
 */
type DatabaseRestoreAccount = {
  id: string;
};

type DatabaseRestoreFrontendStateReconciliationParams<T extends DatabaseRestoreAccount> = {
  accounts: readonly T[];
  selectedAccountId: string | null | undefined;
  savedAccountId: string | null | undefined;
  resetReason?: DatabaseRestoreFrontendCacheResetReason;
  queryClient: Pick<QueryClient, "clear">;
  storage: Pick<Storage, "removeItem">;
  restoreAccountSelection: (accountId: string, options: { focusedPane: "list" }) => void;
  clearSelectedAccount: () => void;
  setSelectedAccountPreference: (accountId: string) => void;
  clearSettingsDirtyState?: () => void;
  storagePolicy?: DatabaseRestoreStorageReconciliationPolicy;
};

export type DatabaseRestoreFrontendCacheResetReason = "database-restore" | "private-data-reset";

type DatabaseRestoreFrontendStateReconciliationResult = {
  queryCacheCleared: boolean;
  resetReason: DatabaseRestoreFrontendCacheResetReason;
  removedStorageKeys: readonly string[];
  selectedAccountId: string | null;
  preferenceAccountId: string;
  restartRequired: true;
};

/**
 * Clear stale frontend state before selecting an account from the restored
 * database, while continuing even if browser storage is unavailable.
 */
export function reconcileDatabaseRestoreFrontendState<T extends DatabaseRestoreAccount>({
  accounts,
  selectedAccountId,
  savedAccountId,
  resetReason = "database-restore",
  queryClient,
  storage,
  restoreAccountSelection,
  clearSelectedAccount,
  setSelectedAccountPreference,
  clearSettingsDirtyState,
  storagePolicy = DATABASE_RESTORE_STORAGE_RECONCILIATION_POLICY,
}: DatabaseRestoreFrontendStateReconciliationParams<T>): DatabaseRestoreFrontendStateReconciliationResult {
  queryClient.clear();
  clearSettingsDirtyState?.();

  const removedStorageKeys: string[] = [];
  for (const storageKey of storagePolicy.removeKeys) {
    try {
      storage.removeItem(storageKey);
      removedStorageKeys.push(storageKey);
    } catch {
      // Restore reconciliation must still repair selection even when localStorage is unavailable.
    }
  }

  const accountSelection = resolveRestoredAccountSelection({
    accounts,
    selectedAccountId,
    savedAccountId,
  });

  if (accountSelection.accountId === null) {
    clearSelectedAccount();
  } else {
    restoreAccountSelection(accountSelection.accountId, {
      focusedPane: "list",
    });
  }
  setSelectedAccountPreference(accountSelection.preferenceAccountId);

  return {
    queryCacheCleared: true,
    resetReason,
    removedStorageKeys,
    selectedAccountId: accountSelection.accountId,
    preferenceAccountId: accountSelection.preferenceAccountId,
    restartRequired: true,
  };
}
