import { useCallback } from "react";
import { useSidebarContextMenuRenderers } from "@/components/reader/hooks/sidebar/use-sidebar-context-menu-renderers";
import { useSidebarFeedSectionController } from "@/components/reader/hooks/sidebar/use-sidebar-feed-section-controller";
import { useSidebarSectionProps } from "@/components/reader/hooks/sidebar/use-sidebar-section-props";
import { useSidebarSmartViews } from "@/components/reader/hooks/sidebar/use-sidebar-smart-views";
import type { SidebarControllerSectionsParams, SidebarSectionPropsResult } from "../../sidebar.types";

export function useSidebarControllerSections({
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
  selectTagFromCurrentContext,
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
  openSubscriptionsIndex,
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
}: SidebarControllerSectionsParams): SidebarSectionPropsResult {
  const visibleSmartViews = useSidebarSmartViews({
    selection,
    totalUnread,
    starredCount,
    showUnreadCount,
    showStarredCount,
    showSidebarUnread,
    showSidebarStarred,
    showSidebarRecentArticles,
    t,
  });
  const {
    renderFolderContextMenu,
    renderFeedContextMenu,
    renderTagContextMenu,
    renderTagSectionContextMenu,
    renderSubscriptionsSectionContextMenu,
  } = useSidebarContextMenuRenderers({
    folders,
    setExpandedFolders,
    onManageTags: handleOpenTagSettings,
  });
  const handleSelectTag = useCallback(
    (tagId: string) => {
      selectTagFromCurrentContext(tagId);
    },
    [selectTagFromCurrentContext],
  );
  const handleSelectSmartView = useCallback(
    (kind: Parameters<typeof selectSmartView>[0]) => {
      if (kind === "unread" && feeds !== undefined && folders !== undefined) {
        const validFolderIds = new Set(folders.map((folder) => folder.id));
        const unreadFolderIds = new Set<string>();

        for (const feed of feeds) {
          if (feed.folder_id !== null && feed.unread_count > 0 && validFolderIds.has(feed.folder_id)) {
            unreadFolderIds.add(feed.folder_id);
          }
        }

        setExpandedFolders(unreadFolderIds);
      }

      selectSmartView(kind);
    },
    [feeds, folders, selectSmartView, setExpandedFolders],
  );
  const { feedTreeProps } = useSidebarFeedSectionController({
    selectedAccountId,
    feeds,
    folders,
    starredCountByFeedId,
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
    tags,
    setExpandedFolders,
    selectFeed: selectFeedFromCurrentContext,
    selectFolder: selectFolderFromCurrentContext,
    selectAll,
    selectSmartView: handleSelectSmartView,
    setViewMode,
    toggleFolder,
    displayFavicons,
    moveFeedToFolder,
    moveFeedToUnfoldered,
    renderFolderContextMenu,
    renderFeedContextMenu,
  });

  return useSidebarSectionProps({
    t,
    syncProgress,
    handleSync,
    syncTooltipLabel,
    isSyncCoolingDown,
    isSyncDisabled,
    handleAddFeed,
    selectedAccountName: selectedAccount?.name,
    lastSyncedLabel,
    accounts: accounts ?? [],
    accountStatusLabels,
    selectedAccountId,
    isAccountListOpen,
    accountMenuId,
    accountDropdownRef,
    accountTriggerRef,
    accountItemRefs,
    toggleAccountList: focusAccountList,
    handleSelectAccount,
    closeAccountList,
    focusAccountList,
    visibleSmartViews,
    selectSmartView: handleSelectSmartView,
    isFeedsSectionOpen,
    toggleFeedsSection,
    feedViewportRef,
    openSubscriptionsIndex,
    handleOpenSettings,
    isAddFeedDialogOpen,
    handleAddFeedDialogOpenChange,
    showSidebarTags,
    isTagsSectionOpen,
    toggleTagsSection,
    handleOpenAccountSettings,
    feedTreeProps,
    tags,
    tagArticleCounts,
    selection,
    selectTag: handleSelectTag,
    renderTagSectionContextMenu,
    renderTagContextMenu,
    renderSubscriptionsSectionContextMenu,
    sidebarDensity,
    isFeedTreeLoading,
    showFeedTreeSkeleton,
  });
}
