import { useRef } from "react";
import { useSidebarAccountSwitcher } from "@/components/reader/hooks/sidebar/use-sidebar-account-switcher";
import { useSidebarSources } from "@/components/reader/hooks/sidebar/use-sidebar-sources";
import { useSidebarSync } from "@/components/reader/hooks/sidebar/use-sidebar-sync";
import { useSidebarUiState } from "@/components/reader/hooks/sidebar/use-sidebar-ui-state";
import { useResolvedDevIntent } from "@/dev/use-resolved-dev-intent";
import { useCancelReaderQueriesOnAccountSwitch } from "@/hooks/use-cancel-reader-queries-on-account-switch";
import type { SidebarRuntimeResult } from "../../sidebar-runtime.types";
import type { SidebarSyncResult } from "./use-sidebar-sync";

export function useSidebarRuntime(): SidebarRuntimeResult {
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
  const { selectedAccountId, syncProgress, applySyncProgress, clearSyncProgress, showToast } = uiState;
  useCancelReaderQueriesOnAccountSwitch(selectedAccountId);
  const sources = useSidebarSources({ selectedAccountId });
  const feedViewportRef = useRef<HTMLDivElement>(null);
  const { intent: activeDevIntent } = useResolvedDevIntent();
  const { handleSync, lastSyncedLabel, syncTooltipLabel, isSyncCoolingDown, isSyncDisabled }: SidebarSyncResult =
    useSidebarSync({
      selectedAccountId,
      syncProgress,
      applySyncProgress,
      clearSyncProgress,
      showToast,
    });
  return {
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
    syncTooltipLabel,
    isSyncCoolingDown,
    isSyncDisabled,
  };
}
