import type { StoreApi } from "zustand";
import type { AddAccountProviderKind } from "@/lib/account/add-account-form";
import type { SettingsCategory } from "@/lib/settings/settings-category.types";
import type { UiState, UiStoreSettingsActions, UiStoreState } from "@/stores/ui-store.types";

type UiStoreSet = StoreApi<UiStoreState>["setState"];

export function getSettingsAccountsViewState(
  accountId: string | null,
  addAccount: boolean,
  initialKind: AddAccountProviderKind | null = null,
): Pick<UiState, "settingsAccountId" | "settingsAddAccount" | "settingsAddAccountInitialKind"> {
  if (addAccount) {
    return {
      settingsAccountId: null,
      settingsAddAccount: true,
      settingsAddAccountInitialKind: initialKind,
    };
  }

  return {
    settingsAccountId: accountId,
    settingsAddAccount: false,
    settingsAddAccountInitialKind: null,
  };
}

function isSettingsSetupLocked(
  state: Pick<
    UiState,
    "accountSetupSession" | "settingsOpen" | "settingsCategory" | "settingsAccountId" | "settingsAddAccount"
  >,
): boolean {
  const { accountSetupSession } = state;
  if (!state.settingsOpen || accountSetupSession === null) {
    return false;
  }

  if (accountSetupSession.state === "verifying") {
    return state.settingsCategory === "accounts" && state.settingsAddAccount;
  }

  return (
    (accountSetupSession.state === "syncing" || accountSetupSession.state === "failed") &&
    state.settingsCategory === "accounts" &&
    state.settingsAccountId === accountSetupSession.accountId
  );
}

function canApplySettingsAccountTransition(
  state: Pick<
    UiState,
    "accountSetupSession" | "settingsOpen" | "settingsCategory" | "settingsAccountId" | "settingsAddAccount"
  >,
  accountId: string | null,
  addAccount: boolean,
): boolean {
  if (!isSettingsSetupLocked(state)) {
    return true;
  }

  const { accountSetupSession } = state;
  return (
    accountSetupSession !== null &&
    !addAccount &&
    accountSetupSession.state !== "verifying" &&
    accountSetupSession.accountId === accountId
  );
}

export function createUiStoreSettingsActions(set: UiStoreSet): UiStoreSettingsActions {
  return {
    openSettings: (tab?: SettingsCategory) =>
      set((state) => ({
        settingsOpen: true,
        settingsCategory: isSettingsSetupLocked(state) ? state.settingsCategory : (tab ?? state.settingsCategory),
      })),
    closeSettings: () =>
      set((state) =>
        isSettingsSetupLocked(state)
          ? state
          : {
              settingsOpen: false,
              settingsCategory: "general",
              settingsAccountId: null,
              settingsAddAccount: false,
              settingsAddAccountInitialKind: null,
              settingsLoading: false,
            },
      ),
    setSettingsCategory: (category) =>
      set((state) =>
        isSettingsSetupLocked(state)
          ? state
          : {
              settingsCategory: category,
              settingsAccountId: null,
              settingsAddAccount: false,
              settingsAddAccountInitialKind: null,
            },
      ),
    openSettingsAccount: (accountId) =>
      set((state) =>
        !canApplySettingsAccountTransition(state, accountId, false)
          ? state
          : {
              settingsOpen: true,
              settingsCategory: "accounts",
              ...getSettingsAccountsViewState(accountId, false),
            },
      ),
    openSettingsAddAccount: (initialKind) =>
      set((state) =>
        isSettingsSetupLocked(state)
          ? state
          : {
              settingsOpen: true,
              settingsCategory: "accounts",
              ...getSettingsAccountsViewState(null, true, initialKind ?? null),
            },
      ),
    setSettingsAccountId: (accountId) =>
      set((state) =>
        canApplySettingsAccountTransition(state, accountId, false)
          ? getSettingsAccountsViewState(accountId, false)
          : state,
      ),
    setSettingsAddAccount: (show, initialKind) =>
      set((state) =>
        canApplySettingsAccountTransition(state, null, show)
          ? getSettingsAccountsViewState(null, show, initialKind ?? null)
          : state,
      ),
    setSettingsAccountsView: (accountId, addAccount, initialKind) =>
      set((state) =>
        canApplySettingsAccountTransition(state, accountId, addAccount)
          ? getSettingsAccountsViewState(accountId, addAccount, initialKind ?? null)
          : state,
      ),
    setSettingsLoading: (loading) => set({ settingsLoading: loading }),
  };
}
