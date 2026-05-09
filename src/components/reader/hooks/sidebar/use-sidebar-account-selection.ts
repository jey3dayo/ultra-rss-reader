import { useEffect } from "react";
import { DEV_SCENARIO_ID } from "@/dev/scenario-ids";
import { getPreferredAccountId } from "@/lib/account/account-selection";
import type { SidebarAccountSelectionParams } from "../../sidebar-runtime.types";

type SidebarAccountSelectionAction =
  | { type: "noop" }
  | { type: "clear"; clearSavedPreference: boolean }
  | {
      type: "restore";
      accountId: string;
      focusedPane: "sidebar" | "list";
      persistPreference: boolean;
    };

function normalizeSelectedAccountId(selectedAccountId: string | null): string | null {
  const normalizedSelectedAccountId = selectedAccountId?.trim() ?? null;
  return normalizedSelectedAccountId && normalizedSelectedAccountId.length > 0 ? normalizedSelectedAccountId : null;
}

export function resolveSidebarAccountSelectionAction({
  accounts,
  preferencesLoaded,
  selectedAccountId,
  savedAccountId,
  layoutMode,
  activeDevIntent,
}: Pick<
  SidebarAccountSelectionParams,
  "accounts" | "preferencesLoaded" | "selectedAccountId" | "savedAccountId" | "layoutMode" | "activeDevIntent"
>): SidebarAccountSelectionAction {
  if (!preferencesLoaded || !accounts) {
    return { type: "noop" };
  }

  if (accounts.length === 0) {
    return {
      type: "clear",
      clearSavedPreference: Boolean(savedAccountId),
    };
  }

  const normalizedSelectedAccountId = normalizeSelectedAccountId(selectedAccountId);
  const hasValidSelection =
    normalizedSelectedAccountId !== null && accounts.some((account) => account.id === normalizedSelectedAccountId);
  if (hasValidSelection || activeDevIntent === DEV_SCENARIO_ID.openWebPreviewUrl) {
    return { type: "noop" };
  }

  const nextAccountId = getPreferredAccountId(accounts, savedAccountId);
  if (!nextAccountId) {
    return { type: "noop" };
  }

  const restoredAccountId = savedAccountId === nextAccountId ? nextAccountId : null;
  return {
    type: "restore",
    accountId: nextAccountId,
    focusedPane: restoredAccountId && layoutMode === "mobile" ? "sidebar" : "list",
    persistPreference: savedAccountId !== nextAccountId,
  };
}

export function useSidebarAccountSelection({
  accounts,
  preferencesLoaded,
  selectedAccountId,
  savedAccountId,
  layoutMode,
  activeDevIntent,
  clearSelectedAccount,
  restoreAccountSelection,
  setSelectedAccountPreference,
}: SidebarAccountSelectionParams) {
  // This intentionally stays separate from updater lifecycle code: the overlap is
  // only the React effect shape, while this hook owns account selection side effects.
  useEffect(() => {
    const action = resolveSidebarAccountSelectionAction({
      accounts,
      preferencesLoaded,
      selectedAccountId,
      savedAccountId,
      layoutMode,
      activeDevIntent,
    });

    if (action.type === "noop") {
      return;
    }

    if (action.type === "clear") {
      if (selectedAccountId !== null) {
        clearSelectedAccount();
      }

      if (action.clearSavedPreference) {
        setSelectedAccountPreference("");
      }
      return;
    }

    restoreAccountSelection(action.accountId, {
      focusedPane: action.focusedPane,
    });

    if (action.persistPreference) {
      setSelectedAccountPreference(action.accountId);
    }
  }, [
    accounts,
    activeDevIntent,
    clearSelectedAccount,
    layoutMode,
    preferencesLoaded,
    restoreAccountSelection,
    savedAccountId,
    selectedAccountId,
    setSelectedAccountPreference,
  ]);
}
