import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { Settings } from "lucide-react";
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
import { type FeedTreeFolderViewModel, FeedTreeView } from "./feed-tree-view";
import { SidebarHeaderView } from "./sidebar-header-view";
import { SmartViewsView } from "./smart-views-view";
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
        "flex h-full w-[280px] flex-col border-r border-border bg-sidebar text-sidebar-foreground",
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

      {/* Scrollable Feed List */}
      <ScrollArea className="flex-1">
        <div className="pb-4">
          <SmartViewsView
            unreadLabel={t("unread")}
            starredLabel={t("starred")}
            unreadCount={totalUnread}
            starredCount={starredCount}
            showUnreadCount={showUnreadCount}
            showStarredCount={showStarredCount}
            selectedKind={selection.type === "smart" ? selection.kind : null}
            onSelectSmartView={selectSmartView}
          />

          <FeedTreeView
            feedsLabel={t("feeds")}
            isOpen={isFeedsSectionOpen}
            onToggleOpen={() => setIsFeedsSectionOpen((v) => !v)}
            folders={sortedFolderList
              .map((folder): FeedTreeFolderViewModel => {
                const folderFeeds = sortFeeds(feedsByFolder.get(folder.id) ?? []);
                return {
                  folder,
                  feeds: folderFeeds,
                  isExpanded: expandedFolderIds.has(folder.id),
                };
              })
              .filter(({ feeds }) => feeds.length > 0)}
            unfolderedFeeds={unfolderedFeeds}
            selectedFeedId={selectedFeedId}
            onToggleFolder={toggleFolder}
            onSelectFeed={selectFeed}
            displayFavicons={displayFavicons}
            grayscaleFavicons={grayscaleFavicons}
            emptyState={
              selectedAccountId ? (
                t("press_plus_to_add_feed")
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    openSettings("accounts");
                    setSettingsAddAccount(true);
                  }}
                  className="text-muted-foreground underline decoration-muted-foreground/50 underline-offset-2 transition-colors hover:text-foreground hover:decoration-foreground/50"
                >
                  {t("add_account_to_start")}
                </button>
              )
            }
          />

          <TagListView
            tagsLabel={t("tags")}
            isOpen={isTagsSectionOpen}
            onToggleOpen={() => setIsTagsSectionOpen((v) => !v)}
            tags={(tags ?? []).map(
              (tag): TagListItemViewModel => ({
                ...tag,
                articleCount: tagArticleCounts?.[tag.id] ?? 0,
                isSelected: selection.type === "tag" && selection.tagId === tag.id,
              }),
            )}
            onSelectTag={selectTag}
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
