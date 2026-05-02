import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import { focusSelectedAccountPaneTarget } from "@/lib/reader-focus";
import { useUiStore } from "@/stores/ui-store";
import { focusAccountItem } from "./account-switcher-menu";
import type { SidebarControllerResult } from "./sidebar.types";
import { useSidebarAccountSelection } from "./use-sidebar-account-selection";
import { useSidebarControllerActions } from "./use-sidebar-controller-actions";
import { useSidebarControllerSections } from "./use-sidebar-controller-sections";
import { useSidebarRuntime } from "./use-sidebar-runtime";
import { useSidebarViewProps } from "./use-sidebar-view-props";

export function useSidebarController(): SidebarControllerResult {
  const { t } = useTranslation("sidebar");
  const {
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
    layoutMode,
    focusedPane,
    selectedAccountId,
    selectAccount,
    restoreAccountSelection,
    clearSelectedAccount,
    selection,
    viewMode,
    selectFeedFromCurrentContext,
    selectFolderFromCurrentContext,
    selectAll,
    selectSmartView,
    selectTagFromCurrentContext,
    setViewMode,
    expandedFolderIds,
    setExpandedFolders,
    toggleFolder,
    openSettings,
    openSubscriptionsIndex,
    isAddFeedDialogOpen,
    openAddFeedDialog,
    closeAddFeedDialog,
    openSettingsAddAccount,
    syncProgress,
    showUnreadCount,
    showStarredCount,
    showSidebarUnread,
    showSidebarStarred,
    showSidebarRecentArticles,
    showSidebarTags,
    displayFavicons,
    grayscaleFavicons,
    sortSubscriptions,
    startupFolderExpansion,
    sidebarDensity,
    opaqueSidebars,
    savedAccountId,
    preferencesLoaded,
    setPref,
    accounts,
    accountStatusLabels,
    selectedAccount,
    feeds,
    folders,
    starredCountByFeedId,
    isFeedTreeLoading,
    showFeedTreeSkeleton,
    tags,
    tagArticleCounts,
    totalUnread,
    starredCount,
    feedViewportRef,
    activeDevIntent,
    handleSync,
    lastSyncedLabel,
    syncTooltipLabel,
    isSyncCoolingDown,
    isSyncDisabled,
  } = useSidebarRuntime();
  const updateFeedFolderMutation = useUpdateFeedFolder();

  const focusAccountList = useCallback(() => {
    const accountCount = accounts?.length ?? 0;
    if (accountCount === 0) {
      return;
    }

    if (layoutMode !== "mobile") {
      closeAccountList();
      useUiStore.getState().openAccountPane();
      requestAnimationFrame(() => {
        focusSelectedAccountPaneTarget();
      });
      return;
    }

    if (accountCount > 1 && !isAccountListOpen) {
      toggleAccountList();
    }

    window.setTimeout(() => {
      if (accountCount <= 1) {
        accountTriggerRef.current?.focus();
        return;
      }

      const selectedIndex = accounts?.findIndex((account) => account.id === selectedAccountId) ?? -1;
      focusAccountItem(accountItemRefs, accountCount, selectedIndex >= 0 ? selectedIndex : 0);
    }, 0);
  }, [
    accountItemRefs,
    accountTriggerRef,
    accounts,
    closeAccountList,
    isAccountListOpen,
    layoutMode,
    selectedAccountId,
    toggleAccountList,
  ]);

  useEffect(() => {
    if (focusedPane !== "sidebar" || selection.type !== "feed") {
      return;
    }

    const selectedFeedId = selection.feedId;
    let frameId = 0;
    let retriesRemaining = 10;
    const focusSelectedFeed = () => {
      const selectedFeedButton = document.querySelector<HTMLButtonElement>(`[data-feed-id="${selectedFeedId}"]`);
      if (!selectedFeedButton) {
        if (retriesRemaining <= 0) {
          return;
        }

        retriesRemaining -= 1;
        frameId = requestAnimationFrame(focusSelectedFeed);
        return;
      }

      selectedFeedButton.focus({ preventScroll: true });
      selectedFeedButton.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    };

    frameId = requestAnimationFrame(focusSelectedFeed);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [focusedPane, selection]);

  const {
    setSelectedAccountPreference,
    moveFeedToFolder,
    moveFeedToUnfoldered,
    handleSelectAccount,
    toggleFeedsSection,
    toggleTagsSection,
    handleOpenSubscriptionsIndex,
    handleOpenSettings,
    handleOpenTagSettings,
    handleOpenAccountSettings,
    handleAddFeed,
    handleAddFeedDialogOpenChange,
  } = useSidebarControllerActions({
    selectedAccountId,
    selectAccount,
    openSettings,
    openSubscriptionsIndex,
    openSettingsAddAccount,
    openAddFeedDialog,
    closeAddFeedDialog,
    setIsFeedsSectionOpen,
    setIsTagsSectionOpen,
    setPref,
    updateFeedFolder: updateFeedFolderMutation.mutateAsync,
  });

  useSidebarAccountSelection({
    accounts,
    preferencesLoaded,
    selectedAccountId,
    savedAccountId,
    layoutMode,
    activeDevIntent,
    clearSelectedAccount,
    restoreAccountSelection,
    setSelectedAccountPreference,
  });

  const { headerProps, accountSectionProps, smartViewsProps, contentSectionsProps } = useSidebarControllerSections({
    t,
    selectedAccountId,
    feeds,
    folders,
    starredCountByFeedId,
    isFeedTreeLoading,
    showFeedTreeSkeleton,
    selection,
    viewMode,
    expandedFolderIds,
    sortSubscriptions,
    grayscaleFavicons,
    isFeedsSectionOpen,
    startupFolderExpansion,
    sidebarDensity,
    showSidebarUnread,
    showSidebarStarred,
    showSidebarRecentArticles,
    showSidebarTags,
    setExpandedFolders,
    selectFeedFromCurrentContext,
    selectFolderFromCurrentContext,
    selectAll,
    selectSmartView,
    setViewMode,
    toggleFolder,
    displayFavicons,
    accounts,
    accountStatusLabels,
    selectedAccount,
    isAccountListOpen,
    accountMenuId,
    accountDropdownRef,
    accountTriggerRef,
    accountItemRefs,
    toggleAccountList,
    handleSelectAccount,
    closeAccountList,
    focusAccountList,
    syncProgress,
    handleSync,
    syncTooltipLabel,
    isSyncCoolingDown,
    isSyncDisabled,
    handleAddFeed,
    toggleFeedsSection,
    lastSyncedLabel,
    totalUnread,
    starredCount,
    showUnreadCount,
    showStarredCount,
    feedViewportRef,
    openSubscriptionsIndex: handleOpenSubscriptionsIndex,
    handleOpenSettings,
    handleOpenTagSettings,
    isAddFeedDialogOpen,
    handleAddFeedDialogOpenChange,
    isTagsSectionOpen,
    toggleTagsSection,
    handleOpenAccountSettings,
    tags,
    tagArticleCounts,
    moveFeedToFolder,
    moveFeedToUnfoldered,
    selectTagFromCurrentContext,
  });

  return useSidebarViewProps({
    opaqueSidebars,
    headerProps,
    accountSectionProps,
    smartViewsProps,
    contentSectionsProps,
  });
}
