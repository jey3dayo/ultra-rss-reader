import { Result } from "@praha/byethrow";
import { ChevronDown, Plus, RefreshCw, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { triggerSync } from "@/api/tauri-commands";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccounts } from "@/hooks/use-accounts";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { AddFeedDialog } from "./add-feed-dialog";
import { FeedItem } from "./feed-item";
import { FolderSection } from "./folder-section";

export function Sidebar() {
  const [showAccountList, setShowAccountList] = useState(false);
  const [showAddFeed, setShowAddFeed] = useState(false);
  const { data: accounts } = useAccounts();
  const {
    selectedAccountId,
    selectAccount,
    selection,
    selectFeed,
    selectSmartView,
    expandedFolderIds,
    toggleFolder,
    openSettings,
  } = useUiStore();
  const { data: feeds } = useFeeds(selectedAccountId);
  const { data: folders } = useFolders(selectedAccountId);
  const showUnreadCount = usePreferencesStore((s) => s.prefs.show_unread_count ?? "true");
  const displayFavicons = usePreferencesStore((s) => s.prefs.display_favicons ?? "true");

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

  // Group feeds by folder
  const feedsByFolder = new Map<string, FeedDto[]>();
  const unfolderedFeeds: FeedDto[] = [];
  for (const feed of feedList) {
    if (feed.folder_id) {
      const existing = feedsByFolder.get(feed.folder_id) ?? [];
      existing.push(feed);
      feedsByFolder.set(feed.folder_id, existing);
    } else {
      unfolderedFeeds.push(feed);
    }
  }

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
          <button
            type="button"
            onClick={handleSync}
            className="rounded p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => selectedAccountId && setShowAddFeed(true)}
            className="rounded p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Account Name with Switcher */}
      <div className="relative px-4 pb-1">
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
        {showUnreadCount === "true" && <span className="text-muted-foreground">{totalUnread.toLocaleString()}</span>}
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
        </div>
      </ScrollArea>

      {/* Bottom Settings Button */}
      <div className="border-t border-sidebar-border p-2">
        <button
          type="button"
          onClick={openSettings}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>
      </div>

      {selectedAccountId && (
        <AddFeedDialog open={showAddFeed} onOpenChange={setShowAddFeed} accountId={selectedAccountId} />
      )}
    </div>
  );
}
