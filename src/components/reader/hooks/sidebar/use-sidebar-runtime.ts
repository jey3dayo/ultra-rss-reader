import { type SetStateAction, useReducer, useRef } from "react";
import { useSidebarAccountSwitcher } from "@/components/reader/hooks/sidebar/use-sidebar-account-switcher";
import { useSidebarSources } from "@/components/reader/hooks/sidebar/use-sidebar-sources";
import { useSidebarSync } from "@/components/reader/hooks/sidebar/use-sidebar-sync";
import { useSidebarUiState } from "@/components/reader/hooks/sidebar/use-sidebar-ui-state";
import { useResolvedDevIntent } from "@/dev/use-resolved-dev-intent";
import type { SidebarRuntimeResult } from "../../sidebar-runtime.types";
import type { SidebarSyncResult } from "./use-sidebar-sync";

type SidebarRuntimeState = {
  isFeedsSectionOpen: boolean;
  isTagsSectionOpen: boolean;
};

type SidebarRuntimeAction =
  | { type: "set-feeds-section-open"; value: SetStateAction<boolean> }
  | { type: "set-tags-section-open"; value: SetStateAction<boolean> };

const initialSidebarRuntimeState: SidebarRuntimeState = {
  isFeedsSectionOpen: true,
  isTagsSectionOpen: true,
};

function sidebarRuntimeReducer(state: SidebarRuntimeState, action: SidebarRuntimeAction): SidebarRuntimeState {
  switch (action.type) {
    case "set-feeds-section-open":
      return {
        ...state,
        isFeedsSectionOpen: resolveNextBooleanValue(state.isFeedsSectionOpen, action.value),
      };
    case "set-tags-section-open":
      return {
        ...state,
        isTagsSectionOpen: resolveNextBooleanValue(state.isTagsSectionOpen, action.value),
      };
    default:
      return state;
  }
}

function resolveNextBooleanValue(currentValue: boolean, nextValue: SetStateAction<boolean>) {
  return typeof nextValue === "function" ? nextValue(currentValue) : nextValue;
}

export function useSidebarRuntime(): SidebarRuntimeResult {
  const [state, dispatch] = useReducer(sidebarRuntimeReducer, initialSidebarRuntimeState);
  const { isFeedsSectionOpen, isTagsSectionOpen } = state;
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
  const setIsFeedsSectionOpen: SidebarRuntimeResult["setIsFeedsSectionOpen"] = (nextValue) => {
    dispatch({ type: "set-feeds-section-open", value: nextValue });
  };
  const setIsTagsSectionOpen: SidebarRuntimeResult["setIsTagsSectionOpen"] = (nextValue) => {
    dispatch({ type: "set-tags-section-open", value: nextValue });
  };

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
    syncTooltipLabel,
    isSyncCoolingDown,
    isSyncDisabled,
  };
}
