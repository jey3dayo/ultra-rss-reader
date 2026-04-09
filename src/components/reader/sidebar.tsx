import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { triggerSync } from "@/api/tauri-commands";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_EVENTS } from "@/constants/events";
import { useAccounts } from "@/hooks/use-accounts";
import { useAccountArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { useResolvedDevIntent } from "@/hooks/use-resolved-dev-intent";
import { useTagArticleCounts, useTags } from "@/hooks/use-tags";
import { useUpdateFeedFolder } from "@/hooks/use-update-feed-folder";
import i18n from "@/lib/i18n";
import { groupFeedsByFolder, sortFeedsByPreference } from "@/lib/sidebar";
import { cn } from "@/lib/utils";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { AddFeedDialog } from "./add-feed-dialog";
import { FeedContextMenuContent } from "./feed-context-menu";
import {
  type ActiveDropTarget,
  type FeedTreeFeedViewModel,
  type FeedTreeFolderViewModel,
  FeedTreeView,
} from "./feed-tree-view";
import { FolderContextMenuContent } from "./folder-context-menu";
import { SidebarAccountSection } from "./sidebar-account-section";
import { SidebarFeedSection } from "./sidebar-feed-section";
import { SidebarFooterActions } from "./sidebar-footer-actions";
import { SidebarHeaderView } from "./sidebar-header-view";
import { SidebarTagSection } from "./sidebar-tag-section";
import { type SmartViewItemViewModel, SmartViewsView } from "./smart-views-view";
import { TagContextMenuContent } from "./tag-context-menu";
import type { TagListItemViewModel } from "./tag-list-view";

function useFormatLastSynced(date: Date | null): string {
  const { t } = useTranslation("sidebar");
  if (!date) return t("not_synced_yet");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (isToday) {
    return t("today_at", { time: `${hours}:${minutes}` });
  }
  const dateStr = date.toLocaleDateString(i18n.language, { month: "short", day: "numeric" });
  return t("date_at", { date: dateStr, time: `${hours}:${minutes}` });
}

export function Sidebar() {
  const { t } = useTranslation("sidebar");
  const [showAccountList, setShowAccountList] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const lastSyncedFormatted = useFormatLastSynced(lastSyncedAt);
  const [isFeedsSectionOpen, setIsFeedsSectionOpen] = useState(true);
  const [isTagsSectionOpen, setIsTagsSectionOpen] = useState(true);
  const [draggedFeedId, setDraggedFeedId] = useState<string | null>(null);
  const [activeDropTarget, setActiveDropTarget] = useState<ActiveDropTarget>(null);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const accountTriggerRef = useRef<HTMLButtonElement>(null);
  const accountItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const accountMenuId = useId();

  // Close account dropdown on click outside
  useEffect(() => {
    if (!showAccountList) return;
    const handler = (e: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node)) {
        setShowAccountList(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAccountList]);
  const { data: accounts } = useAccounts();
  const layoutMode = useUiStore((s) => s.layoutMode);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectAccount = useUiStore((s) => s.selectAccount);
  const clearSelectedAccount = useUiStore((s) => s.clearSelectedAccount);
  const setFocusedPane = useUiStore((s) => s.setFocusedPane);
  const selection = useUiStore((s) => s.selection);
  const viewMode = useUiStore((s) => s.viewMode);
  const selectFeed = useUiStore((s) => s.selectFeed);
  const selectFolder = useUiStore((s) => s.selectFolder);
  const selectAll = useUiStore((s) => s.selectAll);
  const selectSmartView = useUiStore((s) => s.selectSmartView);
  const selectTag = useUiStore((s) => s.selectTag);
  const setViewMode = useUiStore((s) => s.setViewMode);
  const expandedFolderIds = useUiStore((s) => s.expandedFolderIds);
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
  const opaqueSidebars = usePreferencesStore((s) => (s.prefs.opaque_sidebars ?? "false") === "true");
  const updateFeedFolderMutation = useUpdateFeedFolder();

  const savedAccountId = usePreferencesStore((s) => s.prefs.selected_account_id ?? "");
  const setPref = usePreferencesStore((s) => s.setPref);
  const { intent: activeDevIntent } = useResolvedDevIntent();

  // Restore saved account or auto-select first account
  useEffect(() => {
    if (!accounts) return;

    if (accounts.length === 0) {
      if (selectedAccountId !== null) {
        clearSelectedAccount();
      }
      if (savedAccountId) {
        setPref("selected_account_id", "");
      }
      return;
    }

    const hasValidSelection =
      selectedAccountId !== null && accounts.some((account) => account.id === selectedAccountId);
    if (hasValidSelection) return;

    if (activeDevIntent === "open-web-preview-url") {
      return;
    }

    const restoredAccountId = savedAccountId && accounts.some((a) => a.id === savedAccountId) ? savedAccountId : null;
    const nextAccountId = restoredAccountId ?? accounts[0].id;
    selectAccount(nextAccountId);
    if (savedAccountId !== nextAccountId) {
      setPref("selected_account_id", nextAccountId);
    }
    if (restoredAccountId && layoutMode === "mobile") {
      setFocusedPane("sidebar");
    }
  }, [
    activeDevIntent,
    accounts,
    clearSelectedAccount,
    layoutMode,
    savedAccountId,
    selectAccount,
    selectedAccountId,
    setFocusedPane,
    setPref,
  ]);

  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);

  const closeAccountList = useCallback((restoreFocus = false) => {
    setShowAccountList(false);
    if (restoreFocus) {
      accountTriggerRef.current?.focus();
    }
  }, []);
  const toggleAccountList = useCallback(() => {
    setShowAccountList((v) => !v);
  }, []);
  const handleSelectAccount = useCallback(
    (id: string) => {
      selectAccount(id);
      setPref("selected_account_id", id);
    },
    [selectAccount, setPref],
  );
  const toggleFeedsSection = useCallback(() => {
    setIsFeedsSectionOpen((v) => !v);
  }, []);
  const toggleTagsSection = useCallback(() => {
    setIsTagsSectionOpen((v) => !v);
  }, []);
  const handleOpenSettings = useCallback(() => {
    openSettings();
  }, [openSettings]);

  const totalUnread = feeds?.reduce((sum, f) => sum + f.unread_count, 0) ?? 0;
  const starredCount = useMemo(() => accountArticles?.filter((a) => a.is_starred).length ?? 0, [accountArticles]);
  const selectedSmartViewKind = selection.type === "smart" ? selection.kind : null;
  const smartViews: SmartViewItemViewModel[] = [
    {
      kind: "unread",
      label: t("unread"),
      count: totalUnread,
      showCount: showUnreadCount,
      isSelected: selectedSmartViewKind === "unread",
    },
    {
      kind: "starred",
      label: t("starred"),
      count: starredCount,
      showCount: showStarredCount && starredCount > 0,
      isSelected: selectedSmartViewKind === "starred",
    },
  ];
  const visibleSmartViews = smartViews.filter((view) => {
    if (view.kind === "unread") return showSidebarUnread;
    if (view.kind === "starred") return showSidebarStarred;
    return true;
  });

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    let unlistenProgress: (() => void) | undefined;
    let unlistenWarning: (() => void) | undefined;

    listen("sync-progress", (event) => {
      const payload =
        typeof event === "object" && event !== null && "payload" in event
          ? (event.payload as Parameters<typeof applySyncProgress>[0])
          : (event as Parameters<typeof applySyncProgress>[0]);
      applySyncProgress(payload);
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenProgress = fn;
    });

    listen("sync-completed", () => {
      setLastSyncedAt(new Date());
      clearSyncProgress();
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    listen("sync-warning", (event) => {
      const payload =
        typeof event === "object" && event !== null && "payload" in event
          ? (event.payload as Array<{ account_name: string }>)
          : (event as Array<{ account_name: string }>);
      const names = [...new Set(payload.map((warning) => warning.account_name))].join(", ");
      if (names) {
        showToast(t("sync_completed_with_warnings", { accounts: names }));
      }
    }).then((fn) => {
      if (cancelled) fn();
      else unlistenWarning = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
      unlistenProgress?.();
      unlistenWarning?.();
    };
  }, [applySyncProgress, clearSyncProgress, showToast, t]);

  const handleSync = async () => {
    if (syncProgress.active) return;
    const result = await triggerSync();
    Result.pipe(
      result,
      Result.inspect((syncResult) => {
        if (!syncResult.synced) {
          showToast(t("sync_already_in_progress"));
        } else if (syncResult.failed.length > 0) {
          const names = syncResult.failed.map((f) => f.account_name).join(", ");
          showToast(t("sync_partial_failure", { accounts: names }));
        } else if (syncResult.warnings.length > 0) {
          const names = [...new Set(syncResult.warnings.map((warning) => warning.account_name))].join(", ");
          showToast(t("sync_completed_with_warnings", { accounts: names }));
        } else {
          showToast(t("sync_completed"));
        }
      }),
      Result.inspectError((e) => {
        console.error("Sync failed:", e);
        showToast(t("sync_failed"));
      }),
    );
  };

  const handleOpenAccountSettings = useCallback(() => {
    openSettings("accounts");
    setSettingsAddAccount(true);
  }, [openSettings, setSettingsAddAccount]);

  const handleAddFeed = useCallback(() => {
    if (selectedAccountId) {
      openAddFeedDialog();
    } else {
      handleOpenAccountSettings();
    }
  }, [handleOpenAccountSettings, openAddFeedDialog, selectedAccountId]);

  const feedList: FeedDto[] = feeds ?? [];
  const folderList: FolderDto[] = folders ?? [];
  const canDragFeeds = folderList.length > 0;
  const feedById = useMemo(() => new Map(feedList.map((feed) => [feed.id, feed])), [feedList]);

  const { feedsByFolder, unfolderedFeeds: rawUnfolderedFeeds } = useMemo(
    () => groupFeedsByFolder(feedList),
    [feedList],
  );

  const sortedFolderList = useMemo(() => {
    if (sortSubscriptions === "alphabetical") {
      return [...folderList].sort((a, b) => a.name.localeCompare(b.name));
    }
    return folderList;
  }, [folderList, sortSubscriptions]);

  const sortFeeds = useCallback(
    (feeds: FeedDto[]): FeedDto[] => sortFeedsByPreference(feeds, sortSubscriptions),
    [sortSubscriptions],
  );

  const unfolderedFeeds = useMemo(() => sortFeeds(rawUnfolderedFeeds), [rawUnfolderedFeeds, sortFeeds]);

  const selectedFeedId = selection.type === "feed" ? selection.feedId : null;
  const selectedFolderId = selection.type === "folder" ? selection.folderId : null;
  const filterFolderFeedsForSidebar = useCallback(
    (folderFeeds: FeedDto[]) => {
      const sortedFeeds = sortFeeds(folderFeeds);
      if (viewMode === "unread") {
        return sortedFeeds.filter((feed) => feed.unread_count > 0);
      }
      return sortedFeeds;
    },
    [sortFeeds, viewMode],
  );
  const feedTreeFolders = useMemo<FeedTreeFolderViewModel[]>(
    () =>
      sortedFolderList.map((folder) => {
        const rawFolderFeeds = sortFeeds(feedsByFolder.get(folder.id) ?? []);
        const folderFeeds =
          selectedFolderId !== null && folder.id !== selectedFolderId
            ? []
            : filterFolderFeedsForSidebar(rawFolderFeeds);
        const folderUnread = rawFolderFeeds.reduce((sum, feed) => sum + feed.unread_count, 0);
        return {
          id: folder.id,
          name: folder.name,
          accountId: folder.account_id,
          sortOrder: folder.sort_order,
          unreadCount: folderUnread,
          isExpanded: expandedFolderIds.has(folder.id),
          isSelected: selectedFolderId === folder.id,
          feeds: folderFeeds.map((feed) => ({
            id: feed.id,
            accountId: feed.account_id,
            folderId: feed.folder_id,
            title: feed.title,
            url: feed.url,
            siteUrl: feed.site_url,
            unreadCount: feed.unread_count,
            readerMode: feed.reader_mode ?? "inherit",
            webPreviewMode: feed.web_preview_mode ?? "inherit",
            isSelected: selectedFeedId === feed.id,
            grayscaleFavicon: grayscaleFavicons,
          })),
        };
      }),
    [
      expandedFolderIds,
      feedsByFolder,
      filterFolderFeedsForSidebar,
      grayscaleFavicons,
      selectedFeedId,
      selectedFolderId,
      sortFeeds,
      sortedFolderList,
    ],
  );
  const unfolderedFeedViews = useMemo(
    () =>
      (selectedFolderId === null ? filterFolderFeedsForSidebar(unfolderedFeeds) : []).map((feed) => ({
        id: feed.id,
        accountId: feed.account_id,
        folderId: feed.folder_id,
        title: feed.title,
        url: feed.url,
        siteUrl: feed.site_url,
        unreadCount: feed.unread_count,
        readerMode: feed.reader_mode ?? "inherit",
        webPreviewMode: feed.web_preview_mode ?? "inherit",
        isSelected: selectedFeedId === feed.id,
        grayscaleFavicon: grayscaleFavicons,
      })),
    [filterFolderFeedsForSidebar, grayscaleFavicons, selectedFeedId, selectedFolderId, unfolderedFeeds],
  );

  // Build a flat ordered feed list matching render order (folder feeds then unfoldered)
  const orderedFeedIds = useMemo(() => {
    const ids: string[] = [];
    for (const folder of sortedFolderList) {
      const rawFolderFeeds = sortFeeds(feedsByFolder.get(folder.id) ?? []);
      const folderFeeds =
        selectedFolderId !== null && folder.id !== selectedFolderId ? [] : filterFolderFeedsForSidebar(rawFolderFeeds);
      for (const feed of folderFeeds) {
        ids.push(feed.id);
      }
    }
    for (const feed of selectedFolderId === null ? filterFolderFeedsForSidebar(unfolderedFeeds) : []) {
      ids.push(feed.id);
    }
    return ids;
  }, [filterFolderFeedsForSidebar, feedsByFolder, selectedFolderId, sortFeeds, sortedFolderList, unfolderedFeeds]);
  const firstFeedId = orderedFeedIds[0] ?? null;
  const hasSmartUnreadSelection = selection.type === "smart" && selection.kind === "unread";
  const hasSmartStarredSelection = selection.type === "smart" && selection.kind === "starred";
  const hasFilterOnlyUnread = viewMode === "unread" && !hasSmartUnreadSelection;
  const hasFilterOnlyStarred = viewMode === "starred" && !hasSmartStarredSelection;
  const clearDragState = useCallback(() => {
    setDraggedFeedId(null);
    setActiveDropTarget(null);
  }, []);

  const handleDragStartFeed = useCallback((feed: FeedTreeFeedViewModel) => {
    setDraggedFeedId(feed.id);
  }, []);

  const handleDragEnterFolder = useCallback((folderId: string) => {
    setActiveDropTarget({ kind: "folder", folderId });
  }, []);

  const handleDragEnterUnfoldered = useCallback(() => {
    setActiveDropTarget({ kind: "unfoldered" });
  }, []);

  const handleDropToFolder = useCallback(
    async (folderId: string) => {
      try {
        if (!draggedFeedId) return;
        const draggedFeed = feedById.get(draggedFeedId);
        if (!draggedFeed || draggedFeed.folder_id === folderId) return;
        await updateFeedFolderMutation.mutateAsync({ feedId: draggedFeedId, folderId });
      } finally {
        clearDragState();
      }
    },
    [clearDragState, draggedFeedId, feedById, updateFeedFolderMutation],
  );

  const handleDropToUnfoldered = useCallback(async () => {
    try {
      if (!draggedFeedId) return;
      const draggedFeed = feedById.get(draggedFeedId);
      if (!draggedFeed || draggedFeed.folder_id === null) return;
      await updateFeedFolderMutation.mutateAsync({ feedId: draggedFeedId, folderId: null });
    } finally {
      clearDragState();
    }
  }, [clearDragState, draggedFeedId, feedById, updateFeedFolderMutation]);

  useEffect(() => {
    if (!draggedFeedId) {
      return;
    }

    if (!isFeedsSectionOpen || !canDragFeeds || !feedById.has(draggedFeedId)) {
      clearDragState();
    }
  }, [canDragFeeds, clearDragState, draggedFeedId, feedById, isFeedsSectionOpen]);

  useEffect(() => {
    const fallbackToFeedOrAll = () => {
      if (firstFeedId) {
        selectFeed(firstFeedId);
        return;
      }
      selectAll();
    };

    if (hasFilterOnlyStarred && !showSidebarStarred) {
      setViewMode("all");
      return;
    }

    if (hasSmartStarredSelection && !showSidebarStarred) {
      if (showSidebarUnread) {
        selectSmartView("unread");
      } else {
        fallbackToFeedOrAll();
      }
      return;
    }

    if (selection.type === "tag" && !showSidebarTags) {
      if (showSidebarUnread) {
        selectSmartView("unread");
      } else {
        fallbackToFeedOrAll();
      }
      return;
    }

    if (hasFilterOnlyUnread && !showSidebarUnread) {
      setViewMode("all");
      return;
    }

    if (hasSmartUnreadSelection && !showSidebarUnread) {
      fallbackToFeedOrAll();
    }
  }, [
    firstFeedId,
    hasFilterOnlyStarred,
    hasFilterOnlyUnread,
    hasSmartStarredSelection,
    hasSmartUnreadSelection,
    selectAll,
    selectFeed,
    selectSmartView,
    selection,
    setViewMode,
    showSidebarStarred,
    showSidebarTags,
    showSidebarUnread,
  ]);

  const navigateFeed = useCallback(
    (direction: 1 | -1) => {
      if (orderedFeedIds.length === 0) return;
      const currentIndex = selectedFeedId ? orderedFeedIds.indexOf(selectedFeedId) : -1;
      let nextIndex: number;
      if (currentIndex === -1) {
        // No feed selected: go to first (next) or last (prev)
        nextIndex = direction === 1 ? 0 : orderedFeedIds.length - 1;
      } else {
        nextIndex = currentIndex + direction;
        // Clamp to bounds
        if (nextIndex < 0 || nextIndex >= orderedFeedIds.length) return;
      }
      const nextFeedId = orderedFeedIds[nextIndex];
      if (nextFeedId) selectFeed(nextFeedId);
    },
    [orderedFeedIds, selectedFeedId, selectFeed],
  );

  // Listen for feed navigation events from keyboard shortcuts / menu
  useEffect(() => {
    const handler = (e: Event) => {
      const direction = (e as CustomEvent<1 | -1>).detail;
      navigateFeed(direction);
    };
    window.addEventListener(APP_EVENTS.navigateFeed, handler);
    return () => window.removeEventListener(APP_EVENTS.navigateFeed, handler);
  }, [navigateFeed]);

  const handleDropToFolderRequest = useCallback(
    (folderId: string) => {
      void handleDropToFolder(folderId);
    },
    [handleDropToFolder],
  );
  const handleDropToUnfolderedRequest = useCallback(() => {
    void handleDropToUnfoldered();
  }, [handleDropToUnfoldered]);
  const handleAddFeedDialogOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        openAddFeedDialog();
      } else {
        closeAddFeedDialog();
      }
    },
    [closeAddFeedDialog, openAddFeedDialog],
  );
  const renderFolderContextMenu = useCallback(
    (folder: FeedTreeFolderViewModel) => (
      <FolderContextMenuContent
        folder={{
          id: folder.id,
          account_id: folder.accountId,
          name: folder.name,
          sort_order: folder.sortOrder,
        }}
        folderUnread={folder.unreadCount}
      />
    ),
    [],
  );
  const renderFeedContextMenu = useCallback(
    (feed: FeedTreeFeedViewModel) => (
      <FeedContextMenuContent
        feed={{
          id: feed.id,
          account_id: feed.accountId,
          folder_id: feed.folderId,
          title: feed.title,
          url: feed.url,
          site_url: feed.siteUrl,
          unread_count: feed.unreadCount,
          reader_mode: feed.readerMode,
          web_preview_mode: feed.webPreviewMode,
        }}
      />
    ),
    [],
  );
  const renderTagContextMenu = useCallback(
    (tag: TagListItemViewModel) => <TagContextMenuContent tag={{ id: tag.id, name: tag.name, color: tag.color }} />,
    [],
  );
  const feedEmptyState = selectedAccountId
    ? { kind: "message" as const, message: t("press_plus_to_add_feed") }
    : {
        kind: "action" as const,
        label: t("add_account_to_start"),
        onAction: handleOpenAccountSettings,
      };
  const tagItems = useMemo(
    () =>
      (tags ?? []).map(
        (tag): TagListItemViewModel => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          articleCount: tagArticleCounts?.[tag.id] ?? 0,
          isSelected: selection.type === "tag" && selection.tagId === tag.id,
        }),
      ),
    [selection, tagArticleCounts, tags],
  );
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
      onDragStartFeed={handleDragStartFeed}
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
        lastSyncedLabel={lastSyncedFormatted}
        accounts={accounts ?? []}
        selectedAccountId={selectedAccountId}
        isExpanded={showAccountList}
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

      <ScrollArea data-testid="sidebar-feed-scroll-area" className="flex-1">
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
