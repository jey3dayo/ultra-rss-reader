import { useRef, useState } from "react";
import { useResolvedDevIntent } from "@/hooks/use-resolved-dev-intent";
import { useSidebarAccountSwitcher } from "./use-sidebar-account-switcher";
import { useSidebarSources } from "./use-sidebar-sources";
import { useSidebarSync } from "./use-sidebar-sync";
import { useSidebarUiState } from "./use-sidebar-ui-state";

export function useSidebarRuntime() {
  const [isFeedsSectionOpen, setIsFeedsSectionOpen] = useState(true);
  const [isTagsSectionOpen, setIsTagsSectionOpen] = useState(true);
  const {
    isAccountListOpen,
    accountDropdownRef,
    accountTriggerRef,
    accountItemRefs,
    accountMenuId,
    closeAccountList,
    toggleAccountList,
  } = useSidebarAccountSwitcher();
  const uiState = useSidebarUiState();
  const {
    selectedAccountId,
    syncProgress,
    applySyncProgress,
    clearSyncProgress,
    showToast,
  } = uiState;
  const sources = useSidebarSources({ selectedAccountId });
  const feedViewportRef = useRef<HTMLDivElement>(null);
  const { intent: activeDevIntent } = useResolvedDevIntent();
  const { handleSync, lastSyncedLabel } = useSidebarSync({
    syncProgress,
    applySyncProgress,
    clearSyncProgress,
    showToast,
  });

  return {
    isFeedsSectionOpen,
    setIsFeedsSectionOpen,
    isTagsSectionOpen,
    setIsTagsSectionOpen,
    isAccountListOpen,
    accountDropdownRef,
    accountTriggerRef,
    accountItemRefs,
    accountMenuId,
    closeAccountList,
    toggleAccountList,
    ...uiState,
    ...sources,
    feedViewportRef,
    activeDevIntent,
    handleSync,
    lastSyncedLabel,
  };
}
