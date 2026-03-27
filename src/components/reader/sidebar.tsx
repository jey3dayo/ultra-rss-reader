import { Result } from "@praha/byethrow";
import { ChevronDown, Plus, RefreshCw, Settings, Tag } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { triggerSync } from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccounts } from "@/hooks/use-accounts";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { useTags } from "@/hooks/use-tags";
import { groupFeedsByFolder } from "@/lib/sidebar";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { AddFeedDialog } from "./add-feed-dialog";
import { FeedItem } from "./feed-item";
import { FolderSection } from "./folder-section";

export function Sidebar() {
  const [showAccountList, setShowAccountList] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
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
  const { data: feeds } = useFeeds(selectedAccountId);
  const { data: folders } = useFolders(selectedAccountId);
  const { data: tags } = useTags();
  const showUnreadCount = usePreferencesStore((s) => (s.prefs.show_unread_count ?? "true") === "true");
  const displayFavicons = usePreferencesStore((s) => (s.prefs.display_favicons ?? "true") === "true");

  // Auto-select first account if none selected
  useEffect(() => {
    if (!selectedAccountId && accounts && accounts.length > 0) {
      selectAccount(accounts[0].id);
    }
  }, [selectedAccountId, accounts, selectAccount]);

  const selectedAccount = accounts?.find((a) => a.id === selectedAccountId);
  const hasMultipleAccounts = accounts && accounts.length > 1;

  const totalUnread = feeds?.reduce((sum, f) => sum + f.unread_count, 0) ?? 0;

  const handleSync = async () => {
    Result.pipe(
      await triggerSync(),
      Result.inspectError((e) => console.error("Sync failed:", e)),
    );
  };

  const feedList: FeedDto[] = feeds ?? [];
  const folderList: FolderDto[] = folders ?? [];

  const { feedsByFolder, unfolderedFeeds } = useMemo(() => groupFeedsByFolder(feedList), [feedList]);

  const selectedFeedId = selection.type === "feed" ? selection.feedId : null;

  return (
    <div className="flex h-full w-[280px] flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-red-500" />
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-yellow-500" />
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-green-500" />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSync}
            className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Sync feeds"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => selectedAccountId && setShowAddFeed(true)}
            className="text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Add feed"
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
          <h1 className="flex items-center gap-1 text-xl font-semibold text-sidebar-foreground">
            {selectedAccount?.name ?? "Ultra RSS"}
            {hasMultipleAccounts && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </h1>
          <p className="text-xs text-muted-foreground">Today</p>
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
        <span className="font-medium">Unread</span>
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
        <span className="font-medium">Starred</span>
      </button>

      {/* Feeds Section Header */}
      <div className="px-2 py-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-sm font-medium text-sidebar-foreground">Feeds</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Scrollable Feed List */}
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 px-2 pb-4">
          {feedList.length > 0 ? (
            <>
              {folderList.map((folder) => {
                const folderFeeds = feedsByFolder.get(folder.id) ?? [];
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
                />
              ))}
            </>
          ) : (
            selectedAccountId && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">Press + to add a feed</div>
            )
          )}

          {/* Tags Section */}
          {tags && tags.length > 0 && (
            <>
              <div className="mt-2 flex items-center justify-between px-2 py-1">
                <span className="text-sm font-medium text-sidebar-foreground">Tags</span>
                <Tag className="h-4 w-4 text-muted-foreground" />
              </div>
              {tags.map((tag) => (
                <button
                  type="button"
                  key={tag.id}
                  onClick={() => selectTag(tag.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                    selection.type === "tag" && selection.tagId === tag.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                  )}
                >
                  {tag.color && (
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                  )}
                  <span className="truncate">{tag.name}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Bottom Settings Button */}
      <div className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          onClick={openSettings}
          className="flex w-full items-center gap-2 px-2 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </Button>
      </div>

      {selectedAccountId && (
        <AddFeedDialog open={showAddFeed} onOpenChange={setShowAddFeed} accountId={selectedAccountId} />
      )}
    </div>
  );
}
