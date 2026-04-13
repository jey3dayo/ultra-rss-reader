import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { SidebarAccountSwitcherResult } from "./sidebar-runtime.types";

export function useSidebarAccountSwitcher(): SidebarAccountSwitcherResult {
  const [isAccountListOpen, setIsAccountListOpen] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const accountItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const accountMenuId = useId();

  useEffect(() => {
    if (!isAccountListOpen) return;

    const handler = (event: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setIsAccountListOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isAccountListOpen]);

  const closeAccountList = useCallback((restoreFocus = false) => {
    setIsAccountListOpen(false);
    if (restoreFocus) {
      accountTriggerRef.current?.focus();
    }
  }, []);

  const toggleAccountList = useCallback(() => {
    setIsAccountListOpen((value) => !value);
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
