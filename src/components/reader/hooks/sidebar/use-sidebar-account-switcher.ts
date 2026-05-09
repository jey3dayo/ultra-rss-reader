import { useCallback, useEffect, useId, useMemo, useReducer, useRef } from "react";
import type { AccountDto } from "@/api/tauri-commands";
import { focusAccountItem } from "../../account-switcher-menu";
import { isOutsideElement } from "../../dom-target";
import type { SidebarAccountSwitcherResult } from "../../sidebar-runtime.types";

type SidebarAccountSwitcherState = {
  isAccountListOpen: boolean;
};

type SidebarAccountSwitcherAction =
  | { type: "set-account-list-open"; value: boolean }
  | { type: "toggle-account-list-open" };

const initialSidebarAccountSwitcherState: SidebarAccountSwitcherState = {
  isAccountListOpen: false,
};

type AccountSwitcherViewModelParams = {
  accounts: AccountDto[];
  selectedAccountId: string | null;
  isExpanded: boolean;
  itemRefs: SidebarAccountSwitcherResult["accountItemRefs"];
};

type AccountSwitcherViewModel = {
  selectedAccountName: string | null;
  selectedIndex: number;
  hasMultipleAccounts: boolean;
  canOpenAccountList: boolean;
};

function sidebarAccountSwitcherReducer(
  state: SidebarAccountSwitcherState,
  action: SidebarAccountSwitcherAction,
): SidebarAccountSwitcherState {
  switch (action.type) {
    case "set-account-list-open":
      return { ...state, isAccountListOpen: action.value };
    case "toggle-account-list-open":
      return { ...state, isAccountListOpen: !state.isAccountListOpen };
    default:
      return state;
  }
}

export function useSidebarAccountSwitcher(): SidebarAccountSwitcherResult {
  const [state, dispatch] = useReducer(sidebarAccountSwitcherReducer, initialSidebarAccountSwitcherState);
  const { isAccountListOpen } = state;
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const accountItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const accountMenuId = useId();

  useEffect(() => {
    if (!isAccountListOpen) return;

    const handler = (event: MouseEvent) => {
      if (isOutsideElement(accountDropdownRef.current, event.target)) {
        dispatch({ type: "set-account-list-open", value: false });
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isAccountListOpen]);

  const closeAccountList = useCallback((restoreFocus = false) => {
    dispatch({ type: "set-account-list-open", value: false });
    if (restoreFocus) {
      accountTriggerRef.current?.focus();
    }
  }, []);

  const toggleAccountList = useCallback(() => {
    dispatch({ type: "toggle-account-list-open" });
  }, []);

  return {
    isAccountListOpen,
    accountDropdownRef,
    accountTriggerRef,
    accountItemRefs,
    accountMenuId,
    closeAccountList,
    toggleAccountList,
  };
}

export function useAccountSwitcherViewModel({
  accounts,
  selectedAccountId,
  isExpanded,
  itemRefs,
}: AccountSwitcherViewModelParams): AccountSwitcherViewModel {
  const selectedIndex = useMemo(
    () => accounts.findIndex((account) => account.id === selectedAccountId),
    [accounts, selectedAccountId],
  );
  const selectedAccountName = selectedIndex >= 0 ? (accounts[selectedIndex]?.name ?? null) : null;
  const hasMultipleAccounts = selectedIndex >= 0 && accounts.length > 1;
  const canOpenAccountList = hasMultipleAccounts;

  useEffect(() => {
    if (!isExpanded || !hasMultipleAccounts) return;

    const frameId = requestAnimationFrame(() => {
      focusAccountItem(itemRefs, accounts.length, selectedIndex);
    });

    return () => cancelAnimationFrame(frameId);
  }, [accounts.length, hasMultipleAccounts, isExpanded, itemRefs, selectedIndex]);

  return {
    selectedAccountName,
    selectedIndex,
    hasMultipleAccounts,
    canOpenAccountList,
  };
}
