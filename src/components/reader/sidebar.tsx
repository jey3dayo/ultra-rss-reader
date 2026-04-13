import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccounts } from "@/hooks/use-accounts";
import { useAccountArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { useResolvedDevIntent } from "@/hooks/use-resolved-dev-intent";
import { useTagArticleCounts, useTags } from "@/hooks/use-tags";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import { cn } from "@/lib/utils";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { AddFeedDialog } from "./add-feed-dialog";
import { FeedTreeView } from "./feed-tree-view";
import { SidebarAccountSection } from "./sidebar-account-section";
import { SidebarFeedSection } from "./sidebar-feed-section";
import { SidebarFooterActions } from "./sidebar-footer-actions";
import { SidebarHeaderView } from "./sidebar-header-view";
import { SidebarTagSection } from "./sidebar-tag-section";
import { SmartViewsView } from "./smart-views-view";
import { useSidebarAccountSelection } from "./use-sidebar-account-selection";
import { useSidebarAccountStatusLabels } from "./use-sidebar-account-status-labels";
import { useSidebarAccountSwitcher } from "./use-sidebar-account-switcher";
import { useSidebarContextMenuRenderers } from "./use-sidebar-context-menu-renderers";
import { useSidebarFeedDragState } from "./use-sidebar-feed-drag-state";
import { useSidebarFeedNavigation } from "./use-sidebar-feed-navigation";
import { useSidebarFeedTree } from "./use-sidebar-feed-tree";
import { useSidebarSmartViews } from "./use-sidebar-smart-views";
import { useSidebarStartupFolderExpansion } from "./use-sidebar-startup-folder-expansion";
import { useSidebarSync } from "./use-sidebar-sync";
import { useSidebarTagItems } from "./use-sidebar-tag-items";
import { useSidebarUiActions } from "./use-sidebar-ui-actions";
import { useSidebarVisibilityFallback } from "./use-sidebar-visibility-fallback";

export function Sidebar() {
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
  const { data: accounts } = useAccounts();
  const accountStatusLabels = useSidebarAccountStatusLabels(accounts);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectAccount = useUiStore((s) => s.selectAccount);
  const restoreAccountSelection = useUiStore((s) => s.restoreAccountSelection);
  const clearSelectedAccount = useUiStore((s) => s.clearSelectedAccount);
  const selection = useUiStore((s) => s.selection);
  const viewMode = useUiStore((s) => s.viewMode);
  const selectFeed = useUiStore((s) => s.selectFeed);
  const selectFolder = useUiStore((s) => s.selectFolder);
  const selectAll = useUiStore((s) => s.selectAll);
  const selectSmartView = useUiStore((s) => s.selectSmartView);
  const selectTag = useUiStore((s) => s.selectTag);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const expandedFolderIds = useUiStore((s) => s.expandedFolderIds);
  const setExpandedFolders = useUiStore((s) => s.setExpandedFolders);
  const toggleFolder = useUiStore((s) => s.toggleFolder);
  const openSettings = useUiStore((s) => s.openSettings);
  const openFeedCleanup = useUiStore((s) => s.openFeedCleanup);
  const isAddFeedDialogOpen = useUiStore((s) => s.isAddFeedDialogOpen);
  const openAddFeedDialog = useUiStore((s) => s.openAddFeedDialog);
  const closeAddFeedDialog = useUiStore((s) => s.closeAddFeedDialog);
  const setSettingsAddAccount = useUiStore((s) => s.setSettingsAddAccount);
  const showToast = useUiStore((s) => s.showToast);
  const syncProgress = useUiStore((s) => s.syncProgress);
  const applySyncProgress = useUiStore((s) => s.applySyncProgress);
  const clearSyncProgress = useUiStore((s) => s.clearSyncProgress);
  const { data: feeds } = useFeeds(selectedAccountId);
  const { data: folders } = useFolders(selectedAccountId);
  const { data: tags } = useTags();
  const { data: tagArticleCounts } = useTagArticleCounts(selectedAccountId);
  const { data: accountArticles } = useAccountArticles(selectedAccountId);
  const showUnreadCount = usePreferencesStore((s) => (s.prefs.show_unread_count ?? "true") === "true");
  const showStarredCount = usePreferencesStore((s) => (s.prefs.show_starred_count ?? "true") === "true");
  const showSidebarUnread = usePreferencesStore(
    (s) => resolvePreferenceValue(s.prefs, "show_sidebar_unread") === "true",
  );
  const showSidebarStarred = usePreferencesStore(
    (s) => resolvePreferenceValue(s.prefs, "show_sidebar_starred") === "true",
  );
  const showSidebarTags = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "show_sidebar_tags") === "true");
  const displayFavicons = usePreferencesStore((s) => (s.prefs.display_favicons ?? "true") === "true");
  const grayscaleFavicons = usePreferencesStore((s) => (s.prefs.grayscale_favicons ?? "false") === "true");
  const sortSubscriptions = usePreferencesStore((s) => s.prefs.sort_subscriptions ?? "folders_first");
  const startupFolderExpansion = usePreferencesStore((s) =>
    resolvePreferenceValue(s.prefs, "startup_folder_expansion"),
  );
  const opaqueSidebars = usePreferencesStore((s) => (s.prefs.opaque_sidebars ?? "false") === "true");
  const updateFeedFolderMutation = useUpdateFeedFolder();
  const feedViewportRef = useRef<HTMLDivElement>(null);

  const savedAccountId = usePreferencesStore((s) => s.prefs.selected_account_id ?? "");
  const setPref = usePreferencesStore((s) => s.setPref);
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

  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);
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

  const totalUnread = feeds?.reduce((sum, f) => sum + f.unread_count, 0) ?? 0;
  const starredCount = useMemo(() => accountArticles?.filter((a) => a.is_starred).length ?? 0, [accountArticles]);
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

  const feedList = feeds ?? [];
  const folderList = folders ?? [];
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
  const feedEmptyState = selectedAccountId
    ? { kind: "message" as const, message: t("press_plus_to_add_feed") }
    : {
        kind: "action" as const,
        label: t("add_account_to_start"),
        onAction: handleOpenAccountSettings,
      };
  const tagItems = useSidebarTagItems({ tags, tagArticleCounts, selection });
  const feedTree = (
    <FeedTreeView
      isOpen={isFeedsSectionOpen}
      folders={feedTreeFolders}
      unfolderedFeeds={unfolderedFeedViews}
      unfolderedLabel={t("no_folder")}
      onToggleFolder={toggleFolder}
      onSelectFolder={selectFolder}
      onSelectFeed={selectFeed}
      displayFavicons={displayFavicons}
      canDragFeeds={canDragFeeds}
      draggedFeedId={draggedFeedId}
      activeDropTarget={activeDropTarget}
      onDragStartFeed={(feed) => handleDragStartFeed(feed.id)}
      onDragEnterFolder={handleDragEnterFolder}
      onDragEnterUnfoldered={handleDragEnterUnfoldered}
      onDropToFolder={handleDropToFolderRequest}
      onDropToUnfoldered={handleDropToUnfolderedRequest}
      onDragEnd={clearDragState}
      emptyState={feedEmptyState}
      renderFolderContextMenu={renderFolderContextMenu}
      renderFeedContextMenu={renderFeedContextMenu}
    />
  );
  const tagSection = showSidebarTags ? (
    <SidebarTagSection
      tagsLabel={t("tags")}
      isOpen={isTagsSectionOpen}
      onToggleOpen={toggleTagsSection}
      tags={tagItems}
      onSelectTag={selectTag}
      renderContextMenu={renderTagContextMenu}
    />
  ) : null;
  const addFeedDialog = selectedAccountId ? (
    <AddFeedDialog
      open={isAddFeedDialogOpen}
      onOpenChange={handleAddFeedDialogOpenChange}
      accountId={selectedAccountId}
    />
  ) : null;
  const sidebarClassName = cn(
    "flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground",
    opaqueSidebars && "bg-opacity-100",
  );

  return (
    <div className={sidebarClassName}>
      <SidebarHeaderView
        isSyncing={syncProgress.active && syncProgress.kind !== "manual_account"}
        onSync={handleSync}
        onAddFeed={handleAddFeed}
        syncButtonLabel={t("sync_feeds")}
        addFeedButtonLabel={t("add_feed")}
      />

      <SidebarAccountSection
        containerRef={accountDropdownRef}
        title={selectedAccount?.name ?? t("app_name")}
        lastSyncedLabel={lastSyncedLabel}
        accounts={accounts ?? []}
        accountStatusLabels={accountStatusLabels}
        selectedAccountId={selectedAccountId}
        isExpanded={isAccountListOpen}
        menuId={accountMenuId}
        menuLabel={t("accounts")}
        triggerRef={accountTriggerRef}
        itemRefs={accountItemRefs}
        onToggle={toggleAccountList}
        onSelectAccount={handleSelectAccount}
        onClose={closeAccountList}
      />

      <SmartViewsView title={t("smart_views")} views={visibleSmartViews} onSelectSmartView={selectSmartView} />

      <div className="px-4 py-2">
        <div className="h-px bg-sidebar-border/35" />
      </div>

      <SidebarFeedSection title={t("subscriptions")} isOpen={isFeedsSectionOpen} onToggle={toggleFeedsSection} />

      <ScrollArea data-testid="sidebar-feed-scroll-area" className="flex-1" viewportRef={feedViewportRef}>
        <div className="pb-4">
          {feedTree}
          {tagSection}
        </div>
      </ScrollArea>

      <SidebarFooterActions
        feedCleanupLabel={t("feed_cleanup")}
        settingsLabel={t("settings")}
        onOpenFeedCleanup={openFeedCleanup}
        onOpenSettings={handleOpenSettings}
      />

      {addFeedDialog}
    </div>
  );
}
