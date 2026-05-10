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

function getRuntimeDocument(): Document | null {
  return typeof document === "undefined" ? null : document;
}

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
  const restoreFocusFrameRef = useRef<number | null>(null);
  const restoreFocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const accountMenuId = useId();

  const cancelRestoreFocusFrame = useCallback(() => {
    if (restoreFocusFrameRef.current !== null) {
      cancelAnimationFrame(restoreFocusFrameRef.current);
      restoreFocusFrameRef.current = null;
    }
    if (restoreFocusTimeoutRef.current !== null) {
      clearTimeout(restoreFocusTimeoutRef.current);
      restoreFocusTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      cancelRestoreFocusFrame();
    };
  }, [cancelRestoreFocusFrame]);

  useEffect(() => {
    if (!isAccountListOpen) return;

    const handleOutsideTarget = (target: EventTarget | null) => {
      if (isOutsideElement(accountDropdownRef.current, target)) {
        dispatch({ type: "set-account-list-open", value: false });
      }
    };
    const handlePointerOutside = (event: Event) => {
      handleOutsideTarget(event.target);
    };
    const handleFocusOutside = (event: Event) => {
      if (event instanceof FocusEvent) {
        handleOutsideTarget(event.relatedTarget);
      }
    };

    const ownerDocument = accountDropdownRef.current?.ownerDocument ?? getRuntimeDocument();
    if (!ownerDocument) {
      return;
    }

    const listenerEntries: Array<{
      eventName: "pointerdown" | "mousedown" | "touchstart" | "focusout";
      handler: EventListener;
    }> = [
      { eventName: "pointerdown", handler: handlePointerOutside },
      { eventName: "mousedown", handler: handlePointerOutside },
      { eventName: "touchstart", handler: handlePointerOutside },
      { eventName: "focusout", handler: handleFocusOutside },
    ];

    try {
      for (const { eventName, handler } of listenerEntries) {
        ownerDocument.addEventListener(eventName, handler);
      }
    } catch (error) {
      console.warn("Failed to bind sidebar account switcher outside-click listener.", error);
      return;
    }

    return () => {
      try {
        for (const { eventName, handler } of listenerEntries) {
          ownerDocument.removeEventListener(eventName, handler);
        }
      } catch (error) {
        console.warn("Failed to cleanup sidebar account switcher outside-click listener.", error);
      }
    };
  }, [isAccountListOpen]);

  const closeAccountList = useCallback(
    (restoreFocus = false) => {
      dispatch({ type: "set-account-list-open", value: false });
      cancelRestoreFocusFrame();
      if (restoreFocus) {
        const focusTrigger = () => {
          restoreFocusTimeoutRef.current = null;
          if (!isMountedRef.current) {
            return;
          }
          accountTriggerRef.current?.focus();
        };
        const scheduleTimerRestoreFocus = () => {
          const restoreFocusTimeout = setTimeout(focusTrigger, 0);
          restoreFocusTimeoutRef.current = restoreFocusTimeout;
        };
        const restoreFocusOnFrame = () => {
          if (restoreFocusFrameRef.current !== restoreFocusFrame) {
            return;
          }

          restoreFocusFrameRef.current = null;
          focusTrigger();
        };
        let restoreFocusFrame: number | null = null;
        if (typeof requestAnimationFrame === "function") {
          try {
            restoreFocusFrame = requestAnimationFrame(restoreFocusOnFrame);
            restoreFocusFrameRef.current = restoreFocusFrame;
          } catch (error) {
            console.warn("Failed to schedule sidebar account switcher focus restore.", error);
            scheduleTimerRestoreFocus();
          }
        } else {
          scheduleTimerRestoreFocus();
        }
      }
    },
    [cancelRestoreFocusFrame],
  );

  const toggleAccountList = useCallback(() => {
    cancelRestoreFocusFrame();
    dispatch({ type: "toggle-account-list-open" });
  }, [cancelRestoreFocusFrame]);

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

    const focusSelectedItem = () => {
      focusAccountItem(itemRefs, accounts.length, selectedIndex);
    };

    if (typeof requestAnimationFrame === "function") {
      try {
        const frameId = requestAnimationFrame(focusSelectedItem);
        return () => cancelAnimationFrame(frameId);
      } catch (error) {
        console.warn("Failed to schedule account switcher item focus.", error);
      }
    }

    const timeoutId = setTimeout(focusSelectedItem, 0);
    return () => clearTimeout(timeoutId);
  }, [accounts.length, hasMultipleAccounts, isExpanded, itemRefs, selectedIndex]);

  return {
    selectedAccountName,
    selectedIndex,
    hasMultipleAccounts,
    canOpenAccountList,
  };
}
