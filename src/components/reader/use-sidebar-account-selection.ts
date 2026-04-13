import { useEffect } from "react";
import type { AccountDto } from "@/api/tauri-commands";
import type { DevIntent } from "@/lib/dev-intent";
import type { LayoutMode } from "@/stores/ui-store";

type UseSidebarAccountSelectionParams = {
  accounts: AccountDto[] | undefined;
  selectedAccountId: string | null;
  savedAccountId: string;
  layoutMode: LayoutMode;
  activeDevIntent: DevIntent;
  clearSelectedAccount: () => void;
  restoreAccountSelection: (id: string, options?: { focusedPane?: "sidebar" | "list" | "content" }) => void;
  setSelectedAccountPreference: (accountId: string) => void;
};

export function useSidebarAccountSelection({
  accounts,
  selectedAccountId,
  savedAccountId,
  layoutMode,
  activeDevIntent,
  clearSelectedAccount,
  restoreAccountSelection,
  setSelectedAccountPreference,
}: UseSidebarAccountSelectionParams) {
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
