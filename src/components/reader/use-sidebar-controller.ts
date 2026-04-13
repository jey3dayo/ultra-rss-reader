import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useResolvedDevIntent } from "@/hooks/use-resolved-dev-intent";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import { cn } from "@/lib/utils";
import { useSidebarAccountSelection } from "./use-sidebar-account-selection";
import { useSidebarAccountSwitcher } from "./use-sidebar-account-switcher";
import { useSidebarContextMenuRenderers } from "./use-sidebar-context-menu-renderers";
import { useSidebarFeedDragState } from "./use-sidebar-feed-drag-state";
import { useSidebarFeedNavigation } from "./use-sidebar-feed-navigation";
import { useSidebarFeedTree } from "./use-sidebar-feed-tree";
import { useSidebarSmartViews } from "./use-sidebar-smart-views";
import { useSidebarSources } from "./use-sidebar-sources";
import { useSidebarStartupFolderExpansion } from "./use-sidebar-startup-folder-expansion";
import { useSidebarSync } from "./use-sidebar-sync";
import { useSidebarUiActions } from "./use-sidebar-ui-actions";
import { useSidebarUiState } from "./use-sidebar-ui-state";
import { useSidebarVisibilityFallback } from "./use-sidebar-visibility-fallback";

export function useSidebarController() {
  const { t } = useTranslation("sidebar");
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
  const {
    layoutMode,
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
    openFeedCleanup,
    isAddFeedDialogOpen,
    openAddFeedDialog,
    closeAddFeedDialog,
    setSettingsAddAccount,
    showToast,
    syncProgress,
    applySyncProgress,
    clearSyncProgress,
    showUnreadCount,
    showStarredCount,
    showSidebarUnread,
    showSidebarStarred,
    showSidebarTags,
    displayFavicons,
    grayscaleFavicons,
    sortSubscriptions,
    startupFolderExpansion,
    opaqueSidebars,
    savedAccountId,
    setPref,
  } = useSidebarUiState();
  const {
    accounts,
    accountStatusLabels,
    selectedAccount,
    feeds,
    folders,
    tags,
    tagArticleCounts,
    feedList,
    folderList,
    totalUnread,
    starredCount,
  } = useSidebarSources({ selectedAccountId });
  const updateFeedFolderMutation = useUpdateFeedFolder();
  const feedViewportRef = useRef<HTMLDivElement>(null);
  const { intent: activeDevIntent } = useResolvedDevIntent();
  const { handleSync, lastSyncedLabel } = useSidebarSync({
    syncProgress,
    applySyncProgress,
    clearSyncProgress,
    showToast,
  });

  useSidebarAccountSelection({
    accounts,
    selectedAccountId,
    savedAccountId,
    layoutMode,
    activeDevIntent,
    clearSelectedAccount,
    restoreAccountSelection,
    setSelectedAccountPreference: (accountId) => setPref("selected_account_id", accountId),
  });

  const {
    handleSelectAccount,
    toggleFeedsSection,
    toggleTagsSection,
    handleOpenSettings,
    handleOpenAccountSettings,
    handleAddFeed,
    handleAddFeedDialogOpenChange,
  } = useSidebarUiActions({
    selectedAccountId,
    selectAccount,
    setSelectedAccountPreference: (accountId) => setPref("selected_account_id", accountId),
    openSettings,
    setSettingsAddAccount,
    openAddFeedDialog,
    closeAddFeedDialog,
    setIsFeedsSectionOpen,
    setIsTagsSectionOpen,
  });

  const visibleSmartViews = useSidebarSmartViews({
    selection,
    totalUnread,
    starredCount,
    showUnreadCount,
    showStarredCount,
    showSidebarUnread,
    showSidebarStarred,
    t,
  });

  const canDragFeeds = folderList.length > 0;
  const initialFeedById = useMemo(() => new Map(feedList.map((feed) => [feed.id, feed])), [feedList]);
  const {
    draggedFeedId,
    activeDropTarget,
    clearDragState,
    handleDragStartFeed,
    handleDragEnterFolder,
    handleDragEnterUnfoldered,
    handleDropToFolder,
    handleDropToUnfoldered,
  } = useSidebarFeedDragState({
    canDragFeeds,
    isFeedsSectionOpen,
    feedById: initialFeedById,
    moveFeedToFolder: (feedId, folderId) => updateFeedFolderMutation.mutateAsync({ feedId, folderId }),
    moveFeedToUnfoldered: (feedId) => updateFeedFolderMutation.mutateAsync({ feedId, folderId: null }),
  });
  const { feedById, selectedFeedId, feedTreeFolders, unfolderedFeedViews, orderedFeedIds } = useSidebarFeedTree({
    feeds,
    folders,
    selection,
    viewMode,
    expandedFolderIds,
    sortSubscriptions,
    grayscaleFavicons,
    draggedFeedId,
  });
  const firstFeedId = orderedFeedIds[0] ?? null;

  useSidebarStartupFolderExpansion({
    selectedAccountId,
    expandedFolderIds,
    feedList,
    folderList,
    startupFolderExpansion,
    feedsReady: feeds !== undefined,
    foldersReady: folders !== undefined,
    setExpandedFolders,
  });

  useSidebarVisibilityFallback({
    firstFeedId,
    selection,
    viewMode,
    showSidebarUnread,
    showSidebarStarred,
    showSidebarTags,
    selectFeed,
    selectAll,
    selectSmartView,
    setViewMode,
  });

  useSidebarFeedNavigation({
    orderedFeedIds,
    selectedFeedId,
    expandedFolderIds,
    getFeedFolderId: (feedId) => feedById.get(feedId)?.folder_id,
    setExpandedFolders,
    selectFeed,
  });

  const handleDropToFolderRequest = useCallback(
    (folderId: string) => {
      void handleDropToFolder(folderId);
    },
    [handleDropToFolder],
  );
  const handleDropToUnfolderedRequest = useCallback(() => {
    void handleDropToUnfoldered();
  }, [handleDropToUnfoldered]);
  const { renderFolderContextMenu, renderFeedContextMenu, renderTagContextMenu } = useSidebarContextMenuRenderers();

  return {
    sidebarClassName: cn(
      "flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground",
      opaqueSidebars && "bg-opacity-100",
    ),
    headerProps: {
      isSyncing: syncProgress.active && syncProgress.kind !== "manual_account",
      onSync: handleSync,
      onAddFeed: handleAddFeed,
      syncButtonLabel: t("sync_feeds"),
      addFeedButtonLabel: t("add_feed"),
    },
    accountSectionProps: {
      containerRef: accountDropdownRef,
      title: selectedAccount?.name ?? t("app_name"),
      lastSyncedLabel,
      accounts: accounts ?? [],
      accountStatusLabels,
      selectedAccountId,
      isExpanded: isAccountListOpen,
      menuId: accountMenuId,
      menuLabel: t("accounts"),
      triggerRef: accountTriggerRef,
      itemRefs: accountItemRefs,
      onToggle: toggleAccountList,
      onSelectAccount: handleSelectAccount,
      onClose: closeAccountList,
    },
    smartViewsProps: {
      title: t("smart_views"),
      views: visibleSmartViews,
      onSelectSmartView: selectSmartView,
    },
    contentSectionsProps: {
      subscriptionsLabel: t("subscriptions"),
      isFeedsSectionOpen,
      onToggleFeedsSection: toggleFeedsSection,
      viewportRef: feedViewportRef,
      feedCleanupLabel: t("feed_cleanup"),
      settingsLabel: t("settings"),
      onOpenFeedCleanup: openFeedCleanup,
      onOpenSettings: handleOpenSettings,
      selectedAccountId,
      isAddFeedDialogOpen,
      onAddFeedDialogOpenChange: handleAddFeedDialogOpenChange,
      addAccountToStartLabel: t("add_account_to_start"),
      pressPlusToAddFeedLabel: t("press_plus_to_add_feed"),
      tagsLabel: t("tags"),
      noFolderLabel: t("no_folder"),
      showSidebarTags,
      isTagsSectionOpen,
      onToggleTagsSection: toggleTagsSection,
      onOpenAccountSettings: handleOpenAccountSettings,
      feedTreeProps: {
        isOpen: isFeedsSectionOpen,
        folders: feedTreeFolders,
        unfolderedFeeds: unfolderedFeedViews,
        onToggleFolder: toggleFolder,
        onSelectFolder: selectFolder,
        onSelectFeed: selectFeed,
        displayFavicons,
        canDragFeeds,
        draggedFeedId,
        activeDropTarget,
        onDragStartFeed: (feed: { id: string }) => handleDragStartFeed(feed.id),
        onDragEnterFolder: handleDragEnterFolder,
        onDragEnterUnfoldered: handleDragEnterUnfoldered,
        onDropToFolder: handleDropToFolderRequest,
        onDropToUnfoldered: handleDropToUnfolderedRequest,
        onDragEnd: clearDragState,
        renderFolderContextMenu,
        renderFeedContextMenu,
      },
      tags,
      tagArticleCounts,
      selection,
      onSelectTag: selectTag,
      renderTagContextMenu,
    },
  };
}
