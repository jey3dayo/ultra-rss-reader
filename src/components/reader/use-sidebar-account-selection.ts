import { useEffect } from "react";
import { getPreferredAccountId } from "@/components/accounts/get-preferred-account-id";
import { DEV_SCENARIO_ID } from "@/lib/dev-scenario-ids";
import type { SidebarAccountSelectionParams } from "./sidebar-runtime.types";

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
    if (!preferencesLoaded) {
      return;
    }

    if (!accounts) {
      return;
    }

    if (accounts.length === 0) {
      if (selectedAccountId !== null) {
        clearSelectedAccount();
      }

      if (savedAccountId) {
        setSelectedAccountPreference("");
      }
      return;
    }

    const hasValidSelection =
      selectedAccountId !== null && accounts.some((account) => account.id === selectedAccountId);
    if (hasValidSelection || activeDevIntent === DEV_SCENARIO_ID.openWebPreviewUrl) {
      return;
    }

    const nextAccountId = getPreferredAccountId(accounts, savedAccountId);
    if (!nextAccountId) {
      return;
    }
    const restoredAccountId = savedAccountId === nextAccountId ? nextAccountId : null;

    restoreAccountSelection(nextAccountId, {
      focusedPane: restoredAccountId && layoutMode === "mobile" ? "sidebar" : "list",
    });

    if (savedAccountId !== nextAccountId) {
      setSelectedAccountPreference(nextAccountId);
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
