// Fetch-errors toast action: guarded navigation into the account fetch-errors workspace.
import { Result } from "@praha/byethrow";
import { type AccountDto, listAccounts } from "@/api/tauri-commands";
import i18n from "@/lib/i18n";
import { loadI18nResourceNamespace } from "@/lib/i18n-resources";
import { queryClient } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-invalidation";
import { logRuntimeDiagnostic, type RuntimeDiagnosticPolicyId } from "@/lib/runtime/diagnostics";
import { getSettingsDirtyStateSnapshot } from "@/lib/settings/settings-dirty-state-registry";
import type { ToastAction } from "@/lib/ui/toast.types";
import { useUiStore } from "@/stores/ui-store";

let fetchErrorsNavigationGeneration = 0;

export function createFetchErrorsToastAction(accountId: string, label: string): ToastAction | null {
  const account = getFetchErrorsAccount(accountId);
  if (!isLocalFetchErrorsAccount(account)) {
    return null;
  }
  return {
    label,
    onClick: () => {
      const generation = ++fetchErrorsNavigationGeneration;
      const screen = createFetchErrorsNavigationScreenGuard();
      void openFetchErrorsWorkspace(accountId, generation, screen)
        .catch((error: unknown) => reportFetchErrorsNavigationFailure(error, generation, screen))
        .catch((error: unknown) => {
          logRuntimeDiagnostic(
            actionDiagnosticPolicyByCategory.sync,
            "[actions:sync] Failed to report an error while opening feed errors.",
            error,
          );
        })
        .finally(screen.stop);
    },
  };
}

export function getFetchErrorsAccount(accountId: string): AccountDto | undefined {
  return queryClient.getQueryData<AccountDto[]>(queryKeys.accounts.root)?.find((account) => account.id === accountId);
}

export function isLocalFetchErrorsAccount(account: AccountDto | undefined): boolean {
  return account?.kind.toLowerCase() === "local";
}

export const fetchErrorsNavigationScreenKeys = [
  "selectedAccountId",
  "selection",
  "selectedArticleId",
  "contentMode",
  "browserUrl",
  "viewMode",
  "searchQuery",
  "focusedPane",
  "accountPaneOpen",
  "settingsOpen",
  "settingsCategory",
  "settingsAccountId",
  "settingsAddAccount",
  "settingsAddAccountInitialKind",
  "subscriptionsWorkspace",
  "commandPaletteOpen",
  "shortcutsHelpOpen",
  "isAddFeedDialogOpen",
] as const satisfies readonly (keyof ReturnType<typeof useUiStore.getState>)[];

export type FetchErrorsNavigationScreenKey = (typeof fetchErrorsNavigationScreenKeys)[number];
export type FetchErrorsNavigationScreenState = Pick<
  ReturnType<typeof useUiStore.getState>,
  FetchErrorsNavigationScreenKey
> & {
  confirmDialogOpen: boolean;
};

export type FetchErrorsNavigationScreenGuard = {
  isUnchanged: () => boolean;
  stop: () => void;
};

export function captureFetchErrorsNavigationScreen(
  state: ReturnType<typeof useUiStore.getState>,
): FetchErrorsNavigationScreenState {
  return {
    selectedAccountId: state.selectedAccountId,
    selection: state.selection,
    selectedArticleId: state.selectedArticleId,
    contentMode: state.contentMode,
    browserUrl: state.browserUrl,
    viewMode: state.viewMode,
    searchQuery: state.searchQuery,
    focusedPane: state.focusedPane,
    accountPaneOpen: state.accountPaneOpen,
    settingsOpen: state.settingsOpen,
    settingsCategory: state.settingsCategory,
    settingsAccountId: state.settingsAccountId,
    settingsAddAccount: state.settingsAddAccount,
    settingsAddAccountInitialKind: state.settingsAddAccountInitialKind,
    subscriptionsWorkspace: state.subscriptionsWorkspace,
    commandPaletteOpen: state.commandPaletteOpen,
    shortcutsHelpOpen: state.shortcutsHelpOpen,
    isAddFeedDialogOpen: state.isAddFeedDialogOpen,
    confirmDialogOpen: state.confirmDialog.open,
  };
}

export function areFetchErrorsNavigationScreensEqual(
  left: FetchErrorsNavigationScreenState,
  right: FetchErrorsNavigationScreenState,
): boolean {
  if (left.confirmDialogOpen !== right.confirmDialogOpen) {
    return false;
  }

  return fetchErrorsNavigationScreenKeys.every((key) => {
    if (key === "selection") {
      return areReaderSelectionsEqual(left.selection, right.selection);
    }
    return left[key] === right[key];
  });
}

export function areReaderSelectionsEqual(
  left: ReturnType<typeof useUiStore.getState>["selection"],
  right: ReturnType<typeof useUiStore.getState>["selection"],
): boolean {
  if (left.type !== right.type) {
    return false;
  }

  return (
    (left.type === "all" && right.type === "all") ||
    (left.type === "feed" && right.type === "feed" && left.feedId === right.feedId) ||
    (left.type === "folder" && right.type === "folder" && left.folderId === right.folderId) ||
    (left.type === "smart" && right.type === "smart" && left.kind === right.kind) ||
    (left.type === "tag" && right.type === "tag" && left.tagId === right.tagId)
  );
}

export function createFetchErrorsNavigationScreenGuard(): FetchErrorsNavigationScreenGuard {
  const initialScreen = captureFetchErrorsNavigationScreen(useUiStore.getState());
  let changed = false;
  let stopped = false;
  const unsubscribe = useUiStore.subscribe((state) => {
    if (!areFetchErrorsNavigationScreensEqual(initialScreen, captureFetchErrorsNavigationScreen(state))) {
      changed = true;
    }
  });
  const stop = () => {
    if (stopped) {
      return;
    }
    stopped = true;
    unsubscribe();
  };

  return {
    isUnchanged: () => {
      if (
        !changed &&
        !stopped &&
        !areFetchErrorsNavigationScreensEqual(initialScreen, captureFetchErrorsNavigationScreen(useUiStore.getState()))
      ) {
        changed = true;
      }
      return !changed;
    },
    stop,
  };
}

export function isFetchErrorsNavigationCurrent(generation: number, screen: FetchErrorsNavigationScreenGuard): boolean {
  return generation === fetchErrorsNavigationGeneration && screen.isUnchanged();
}

export async function openFetchErrorsWorkspace(
  accountId: string,
  generation: number,
  screen: FetchErrorsNavigationScreenGuard,
): Promise<void> {
  const accounts = await queryClient.fetchQuery({
    queryKey: queryKeys.accounts.root,
    queryFn: () => listAccounts().then(Result.unwrap()),
    staleTime: 0,
  });
  if (
    !isFetchErrorsNavigationCurrent(generation, screen) ||
    !accounts.some((account) => account.id === accountId && isLocalFetchErrorsAccount(account))
  ) {
    return;
  }
  const store = useUiStore.getState();
  const currentReturnState =
    store.subscriptionsWorkspace?.kind === "index" && store.subscriptionsWorkspace.returnState?.accountId === accountId
      ? store.subscriptionsWorkspace.returnState
      : undefined;
  if (store.settingsOpen) {
    const dirtyState = getSettingsDirtyStateSnapshot();
    if (dirtyState.dirty || dirtyState.pending) {
      return;
    }
  }
  if (!isFetchErrorsNavigationCurrent(generation, screen)) {
    return;
  }

  screen.stop();
  if (generation !== fetchErrorsNavigationGeneration) {
    return;
  }
  if (store.settingsOpen) {
    store.closeSettings();
  }
  const stateAfterSettingsClose = useUiStore.getState();
  if (generation !== fetchErrorsNavigationGeneration || stateAfterSettingsClose.settingsOpen) {
    return;
  }
  if (stateAfterSettingsClose.selectedAccountId !== accountId) {
    stateAfterSettingsClose.selectAccount(accountId);
  }
  if (generation !== fetchErrorsNavigationGeneration) {
    return;
  }
  useUiStore.getState().openSubscriptionsIndex(currentReturnState, { accountId, summaryFilter: "fetch_errors" });
}

export async function reportFetchErrorsNavigationFailure(
  error: unknown,
  generation: number,
  screen: FetchErrorsNavigationScreenGuard,
): Promise<void> {
  if (!isFetchErrorsNavigationCurrent(generation, screen)) {
    return;
  }

  logRuntimeDiagnostic(
    actionDiagnosticPolicyByCategory.sync,
    "[actions:sync] Failed to verify the account before opening feed errors.",
    error,
  );

  let message: string;
  try {
    await loadI18nResourceNamespace(i18n, "subscriptions");
    if (!isFetchErrorsNavigationCurrent(generation, screen)) {
      return;
    }
    message = i18n.t("subscriptions:fetch_error_navigation_failed");
  } catch (namespaceError: unknown) {
    if (!isFetchErrorsNavigationCurrent(generation, screen)) {
      return;
    }
    logRuntimeDiagnostic(
      actionDiagnosticPolicyByCategory.sync,
      "[actions:sync] Failed to load the feed errors message translation.",
      namespaceError,
    );
    message = i18n.t("sidebar:sync_failed");
  }

  if (!isFetchErrorsNavigationCurrent(generation, screen)) {
    return;
  }
  useUiStore.getState().showToast({ message, severity: "error" });
}

export type GlobalActionDiagnosticCategory = "window" | "sync" | "browser" | "updates";
export const actionDiagnosticPolicyByCategory = {
  window: "app-action-window",
  sync: "app-action-sync",
  browser: "app-action-browser",
  updates: "app-action-updates",
} as const satisfies Record<GlobalActionDiagnosticCategory, RuntimeDiagnosticPolicyId>;
