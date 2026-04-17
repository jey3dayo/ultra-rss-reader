import { useEffect } from "react";
import { getPreferredAccountId } from "@/components/accounts/get-preferred-account-id";
import { DEV_SCENARIO_ID } from "@/lib/dev-scenario-ids";
import type { SidebarAccountSelectionParams } from "./sidebar-runtime.types";

type SidebarAccountSelectionAction =
  | { type: "noop" }
  | { type: "clear"; clearSavedPreference: boolean }
  | {
      type: "restore";
      accountId: string;
      focusedPane: "sidebar" | "list";
      persistPreference: boolean;
    };

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

  const hasValidSelection = selectedAccountId !== null && accounts.some((account) => account.id === selectedAccountId);
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
