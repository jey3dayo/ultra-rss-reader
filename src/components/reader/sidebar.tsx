import { ContextMenu } from "@base-ui/react/context-menu";
import { Result } from "@praha/byethrow";
import { listen } from "@tauri-apps/api/event";
import { ChevronDown, Plus, RefreshCw, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { groupFeedsByFolder } from "@/lib/sidebar";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { AddFeedDialog } from "./add-feed-dialog";
import { FeedItem } from "./feed-item";
import { FolderSection } from "./folder-section";
import { TagContextMenuContent } from "./tag-context-menu";

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
  const hasMultipleAccounts = accounts && accounts.length > 1;

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
    (feeds: FeedDto[]): FeedDto[] => {
      if (sortSubscriptions === "alphabetical") {
        return [...feeds].sort((a, b) => a.title.localeCompare(b.title));
      }
      if (sortSubscriptions === "newest_first" || sortSubscriptions === "oldest_first") {
        const dir = sortSubscriptions === "newest_first" ? -1 : 1;
        return [...feeds].sort((a, b) => a.title.localeCompare(b.title) * dir);
      }
      return feeds;
    },
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
      {/* Header - left padding for macOS traffic lights, draggable for window move */}
      <div data-tauri-drag-region className="flex h-12 items-center justify-end px-4 pl-20">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label={t("sync_feeds")}
          >
            <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              if (selectedAccountId) {
                openAddFeedDialog();
              } else {
                openSettings("accounts");
                setSettingsAddAccount(true);
              }
            }}
            className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label={t("add_feed")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Account Name with Switcher */}
      <div ref={accountDropdownRef} className="relative px-4 pb-1">
        <button
          type="button"
          onClick={() => hasMultipleAccounts && setShowAccountList((v) => !v)}
          className={cn("text-left", hasMultipleAccounts ? "cursor-pointer" : "cursor-default")}
        >
          <h1 className="flex items-center gap-1 text-2xl font-bold text-sidebar-foreground">
            {selectedAccount?.name ?? t("app_name")}
            {hasMultipleAccounts && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </h1>
          <p className="text-xs text-muted-foreground">{lastSyncedFormatted}</p>
        </button>

        {/* Account dropdown */}
        {showAccountList && accounts && (
          <div className="absolute top-full left-0 z-50 min-w-[180px] rounded-lg border border-border bg-sidebar p-1 shadow-lg">
            {accounts.map((acc) => (
              <button
                type="button"
                key={acc.id}
                onClick={() => {
                  selectAccount(acc.id);
                  setShowAccountList(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                  acc.id === selectedAccountId
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                {acc.name}
                <span className="text-xs text-muted-foreground">{acc.kind}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Unread Smart View */}
      <button
        type="button"
        onClick={() => selectSmartView("unread")}
        className={cn(
          "mx-2 my-1 flex items-center justify-between rounded-md px-2 py-2 text-sm",
          selection.type === "smart" && selection.kind === "unread"
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "hover:bg-sidebar-accent/50",
        )}
      >
        <span className="font-medium">{t("unread")}</span>
        {showUnreadCount && <span className="text-muted-foreground">{totalUnread.toLocaleString()}</span>}
      </button>

      {/* Starred Smart View */}
      <button
        type="button"
        onClick={() => selectSmartView("starred")}
        className={cn(
          "mx-2 my-0.5 flex items-center justify-between rounded-md px-2 py-2 text-sm",
          selection.type === "smart" && selection.kind === "starred"
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "hover:bg-sidebar-accent/50",
        )}
      >
        <span className="font-medium">{t("starred")}</span>
        {showStarredCount && starredCount > 0 && (
          <span className="text-muted-foreground">{starredCount.toLocaleString()}</span>
        )}
      </button>

      {/* Feeds Section Header */}
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

      {/* Scrollable Feed List */}
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 px-2 pb-4">
          {feedList.length > 0 ? (
            isFeedsSectionOpen && (
              <>
                {sortedFolderList.map((folder) => {
                  const folderFeeds = sortFeeds(feedsByFolder.get(folder.id) ?? []);
                  if (folderFeeds.length === 0) return null;
                  return (
                    <FolderSection
                      key={folder.id}
                      folder={folder}
                      feeds={folderFeeds}
                      isExpanded={expandedFolderIds.has(folder.id)}
                      onToggle={toggleFolder}
                      selectedFeedId={selectedFeedId}
                      onSelectFeed={selectFeed}
                      displayFavicons={displayFavicons}
                      grayscaleFavicons={grayscaleFavicons}
                    />
                  );
                })}
                {unfolderedFeeds.map((feed) => (
                  <FeedItem
                    key={feed.id}
                    feed={feed}
                    isSelected={selectedFeedId === feed.id}
                    onSelect={selectFeed}
                    displayFavicons={displayFavicons}
                    grayscaleFavicons={grayscaleFavicons}
                  />
                ))}
              </>
            )
          ) : (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              {selectedAccountId ? (
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
              )}
            </div>
          )}

          {/* Tags Section */}
          {tags && tags.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setIsTagsSectionOpen((v) => !v)}
                className="mt-2 flex w-full items-center justify-between px-2 py-1"
              >
                <span className="text-sm font-medium text-sidebar-foreground">{t("tags")}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    !isTagsSectionOpen && "-rotate-90",
                  )}
                />
              </button>
              {isTagsSectionOpen &&
                tags.map((tag) => (
                  <ContextMenu.Root key={tag.id}>
                    <ContextMenu.Trigger
                      render={
                        <button
                          type="button"
                          onClick={() => selectTag(tag.id)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm",
                            selection.type === "tag" && selection.tagId === tag.id
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                          )}
                        />
                      }
                    >
                      <div className="flex items-center gap-2 truncate">
                        {tag.color && (
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                        )}
                        <span className="truncate">{tag.name}</span>
                      </div>
                      {tagArticleCounts?.[tag.id] != null && tagArticleCounts[tag.id] > 0 && (
                        <span className="ml-2 shrink-0 text-muted-foreground">
                          {tagArticleCounts[tag.id].toLocaleString()}
                        </span>
                      )}
                    </ContextMenu.Trigger>
                    <TagContextMenuContent tag={tag} />
                  </ContextMenu.Root>
                ))}
            </>
          )}
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
