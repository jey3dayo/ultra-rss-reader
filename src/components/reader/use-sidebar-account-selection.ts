import { useEffect } from "react";
import type { SidebarAccountSelectionParams } from "./sidebar-runtime.types";

export function useSidebarAccountSelection({
  accounts,
  selectedAccountId,
  savedAccountId,
  layoutMode,
  activeDevIntent,
  clearSelectedAccount,
  restoreAccountSelection,
  setSelectedAccountPreference,
}: SidebarAccountSelectionParams) {
  useEffect(() => {
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
    if (hasValidSelection || activeDevIntent === "open-web-preview-url") {
      return;
    }

    const restoredAccountId =
      savedAccountId && accounts.some((account) => account.id === savedAccountId) ? savedAccountId : null;
    const nextAccountId = restoredAccountId ?? accounts[0].id;

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
    restoreAccountSelection,
    savedAccountId,
    selectedAccountId,
    setSelectedAccountPreference,
  ]);
}
