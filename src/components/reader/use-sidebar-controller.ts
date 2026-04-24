import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
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
    selectFeed,
    selectFolder,
    selectAll,
    selectSmartView,
    selectTag,
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
    showSidebarTags,
    setExpandedFolders,
    selectFeed,
    selectFolder,
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
    selectTag,
  });

  return useSidebarViewProps({
    opaqueSidebars,
    headerProps,
    accountSectionProps,
    smartViewsProps,
    contentSectionsProps,
  });
}
