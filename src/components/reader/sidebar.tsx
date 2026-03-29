import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { ChevronDown, Settings } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { triggerSync } from "@/api/tauri-commands";
import { controlChipIconVariants, controlChipVariants } from "@/components/shared/control-chip";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccounts } from "@/hooks/use-accounts";
import { useAccountArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { useTagArticleCounts, useTags } from "@/hooks/use-tags";
import { actionEvents } from "@/lib/actions";
import i18n from "@/lib/i18n";
import { groupFeedsByFolder, sortFeedsByPreference } from "@/lib/sidebar";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { AccountSwitcherView } from "./account-switcher-view";
import { AddFeedDialog } from "./add-feed-dialog";
import { FeedContextMenuContent } from "./feed-context-menu";
import { type FeedTreeFolderViewModel, FeedTreeView } from "./feed-tree-view";
import { FolderContextMenuContent } from "./folder-context-menu";
import { SidebarHeaderView } from "./sidebar-header-view";
import { type SmartViewItemViewModel, SmartViewsView } from "./smart-views-view";
import { TagContextMenuContent } from "./tag-context-menu";
import { type TagListItemViewModel, TagListView } from "./tag-list-view";

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
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const lastSyncedFormatted = useFormatLastSynced(lastSyncedAt);
  const [isFeedsSectionOpen, setIsFeedsSectionOpen] = useState(true);
  const [isTagsSectionOpen, setIsTagsSectionOpen] = useState(true);
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
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectAccount = useUiStore((s) => s.selectAccount);
  const selection = useUiStore((s) => s.selection);
  const selectFeed = useUiStore((s) => s.selectFeed);
  const selectSmartView = useUiStore((s) => s.selectSmartView);
  const selectTag = useUiStore((s) => s.selectTag);
  const expandedFolderIds = useUiStore((s) => s.expandedFolderIds);
  const toggleFolder = useUiStore((s) => s.toggleFolder);
  const openSettings = useUiStore((s) => s.openSettings);
  const isAddFeedDialogOpen = useUiStore((s) => s.isAddFeedDialogOpen);
  const openAddFeedDialog = useUiStore((s) => s.openAddFeedDialog);
  const closeAddFeedDialog = useUiStore((s) => s.closeAddFeedDialog);
  const setSettingsAddAccount = useUiStore((s) => s.setSettingsAddAccount);
  const showToast = useUiStore((s) => s.showToast);
  const { data: feeds } = useFeeds(selectedAccountId);
  const { data: folders } = useFolders(selectedAccountId);
  const { data: tags } = useTags();
  const { data: tagArticleCounts } = useTagArticleCounts();
  const { data: accountArticles } = useAccountArticles(selectedAccountId);
  const showUnreadCount = usePreferencesStore((s) => (s.prefs.show_unread_count ?? "true") === "true");
  const showStarredCount = usePreferencesStore((s) => (s.prefs.show_starred_count ?? "true") === "true");
  const displayFavicons = usePreferencesStore((s) => (s.prefs.display_favicons ?? "true") === "true");
  const grayscaleFavicons = usePreferencesStore((s) => (s.prefs.grayscale_favicons ?? "false") === "true");
  const sortSubscriptions = usePreferencesStore((s) => s.prefs.sort_subscriptions ?? "folders_first");
  const opaqueSidebars = usePreferencesStore((s) => (s.prefs.opaque_sidebars ?? "false") === "true");

  // Auto-select first account if none selected
  useEffect(() => {
    if (!selectedAccountId && accounts && accounts.length > 0) {
      selectAccount(accounts[0].id);
    }
  }, [selectedAccountId, accounts, selectAccount]);

  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);

  const closeAccountList = useCallback((restoreFocus = false) => {
    setShowAccountList(false);
    if (restoreFocus) {
      accountTriggerRef.current?.focus();
    }
  }, []);

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

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    listen("sync-completed", () => {
      setLastSyncedAt(new Date());
    }).then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    Result.pipe(
      await triggerSync(),
      Result.inspect((didSync) => {
        if (didSync) {
          showToast(t("sync_completed"));
        }
      }),
      Result.inspectError((e) => {
        console.error("Sync failed:", e);
        showToast(t("sync_failed"));
      }),
    );
    setIsSyncing(false);
  };

  const handleAddFeed = useCallback(() => {
    if (selectedAccountId) {
      openAddFeedDialog();
    } else {
      openSettings("accounts");
      setSettingsAddAccount(true);
    }
  }, [openAddFeedDialog, openSettings, selectedAccountId, setSettingsAddAccount]);

  const feedList: FeedDto[] = feeds ?? [];
  const folderList: FolderDto[] = folders ?? [];

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
  const feedTreeFolders = useMemo<FeedTreeFolderViewModel[]>(
    () =>
      sortedFolderList
        .map((folder) => {
          const folderFeeds = sortFeeds(feedsByFolder.get(folder.id) ?? []);
          const folderUnread = folderFeeds.reduce((sum, feed) => sum + feed.unread_count, 0);
          return {
            id: folder.id,
            name: folder.name,
            accountId: folder.account_id,
            unreadCount: folderUnread,
            isExpanded: expandedFolderIds.has(folder.id),
            feeds: folderFeeds.map((feed) => ({
              id: feed.id,
              accountId: feed.account_id,
              folderId: feed.folder_id,
              title: feed.title,
              url: feed.url,
              siteUrl: feed.site_url,
              unreadCount: feed.unread_count,
              displayMode: feed.display_mode,
              isSelected: selectedFeedId === feed.id,
              grayscaleFavicon: grayscaleFavicons,
            })),
          };
        })
        .filter((folder) => folder.feeds.length > 0),
    [expandedFolderIds, feedsByFolder, grayscaleFavicons, selectedFeedId, sortFeeds, sortedFolderList],
  );
  const unfolderedFeedViews = useMemo(
    () =>
      unfolderedFeeds.map((feed) => ({
        id: feed.id,
        accountId: feed.account_id,
        folderId: feed.folder_id,
        title: feed.title,
        url: feed.url,
        siteUrl: feed.site_url,
        unreadCount: feed.unread_count,
        displayMode: feed.display_mode,
        isSelected: selectedFeedId === feed.id,
        grayscaleFavicon: grayscaleFavicons,
      })),
    [grayscaleFavicons, selectedFeedId, unfolderedFeeds],
  );

  // Build a flat ordered feed list matching render order (folder feeds then unfoldered)
  const orderedFeedIds = useMemo(() => {
    const ids: string[] = [];
    for (const folder of sortedFolderList) {
      const folderFeeds = sortFeeds(feedsByFolder.get(folder.id) ?? []);
      for (const feed of folderFeeds) {
        ids.push(feed.id);
      }
    }
    for (const feed of unfolderedFeeds) {
      ids.push(feed.id);
    }
    return ids;
  }, [sortedFolderList, feedsByFolder, unfolderedFeeds, sortFeeds]);

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
    window.addEventListener(actionEvents.navigateFeed, handler);
    return () => window.removeEventListener(actionEvents.navigateFeed, handler);
  }, [navigateFeed]);

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar text-sidebar-foreground",
        opaqueSidebars && "bg-opacity-100",
      )}
    >
      <div data-tauri-drag-region>
        <SidebarHeaderView
          isSyncing={isSyncing}
          onSync={handleSync}
          onAddFeed={handleAddFeed}
          syncButtonLabel={t("sync_feeds")}
          addFeedButtonLabel={t("add_feed")}
        />
      </div>

      <div ref={accountDropdownRef}>
        <AccountSwitcherView
          title={selectedAccount?.name ?? t("app_name")}
          lastSyncedLabel={lastSyncedFormatted}
          accounts={accounts ?? []}
          selectedAccountId={selectedAccountId}
          isExpanded={showAccountList}
          menuId={accountMenuId}
          menuLabel={t("accounts")}
          triggerRef={accountTriggerRef}
          itemRefs={accountItemRefs}
          onToggle={() => setShowAccountList((v) => !v)}
          onSelectAccount={selectAccount}
          onClose={closeAccountList}
        />
      </div>

      <SmartViewsView views={smartViews} onSelectSmartView={selectSmartView} />

      <div className="px-2 py-2">
        <button
          type="button"
          onClick={() => setIsFeedsSectionOpen((v) => !v)}
          className="flex w-full items-center justify-between px-2 py-1"
        >
          <span className="text-sm font-medium text-sidebar-foreground">{t("feeds")}</span>
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", !isFeedsSectionOpen && "-rotate-90")}
          />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="pb-4">
          <FeedTreeView
            isOpen={isFeedsSectionOpen}
            folders={feedTreeFolders}
            unfolderedFeeds={unfolderedFeedViews}
            onToggleFolder={toggleFolder}
            onSelectFeed={selectFeed}
            displayFavicons={displayFavicons}
            emptyState={
              selectedAccountId
                ? { kind: "message", message: t("press_plus_to_add_feed") }
                : {
                    kind: "action",
                    label: t("add_account_to_start"),
                    onAction: () => {
                      openSettings("accounts");
                      setSettingsAddAccount(true);
                    },
                  }
            }
            renderFolderContextMenu={(folder) => (
              <FolderContextMenuContent
                folder={{ id: folder.id, account_id: folder.accountId, name: folder.name, sort_order: 0 }}
                folderUnread={folder.unreadCount}
              />
            )}
            renderFeedContextMenu={(feed) => (
              <FeedContextMenuContent
                feed={{
                  id: feed.id,
                  account_id: feed.accountId,
                  folder_id: feed.folderId,
                  title: feed.title,
                  url: feed.url,
                  site_url: feed.siteUrl,
                  unread_count: feed.unreadCount,
                  display_mode: feed.displayMode,
                }}
              />
            )}
          />

          <TagListView
            tagsLabel={t("tags")}
            isOpen={isTagsSectionOpen}
            onToggleOpen={() => setIsTagsSectionOpen((v) => !v)}
            tags={(tags ?? []).map(
              (tag): TagListItemViewModel => ({
                id: tag.id,
                name: tag.name,
                color: tag.color,
                articleCount: tagArticleCounts?.[tag.id] ?? 0,
                isSelected: selection.type === "tag" && selection.tagId === tag.id,
              }),
            )}
            onSelectTag={selectTag}
            renderContextMenu={(tag) => (
              <TagContextMenuContent tag={{ id: tag.id, name: tag.name, color: tag.color }} />
            )}
          />
        </div>
      </ScrollArea>

      {/* Bottom Settings Button */}
      <div className="flex h-10 items-center justify-center border-t border-sidebar-border px-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openSettings()}
          className={controlChipVariants({ size: "comfortable", interaction: "action" })}
        >
          <Settings className={controlChipIconVariants({ size: "comfortable" })} />
          <span>{t("settings")}</span>
        </Button>
      </div>

      {selectedAccountId && (
        <AddFeedDialog
          open={isAddFeedDialogOpen}
          onOpenChange={(open) => (open ? openAddFeedDialog() : closeAddFeedDialog())}
          accountId={selectedAccountId}
        />
      )}
    </div>
  );
}
