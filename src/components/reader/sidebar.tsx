import { Result } from "@praha/byethrow";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Plus, RefreshCw, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import { addLocalFeed, triggerSync } from "@/api/tauri-commands";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccounts } from "@/hooks/use-accounts";
import { useFeeds } from "@/hooks/use-feeds";
import { useFolders } from "@/hooks/use-folders";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

function AddFeedDialog({
  open,
  onOpenChange,
  accountId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) {
      setUrl("");
      setError(null);
      setLoading(false);
      // Focus input after dialog opens
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);

    Result.pipe(
      await addLocalFeed(accountId, trimmed),
      Result.inspectError((e) => setError(e.message)),
      Result.inspect(() => {
        qc.invalidateQueries({ queryKey: ["feeds"] });
        onOpenChange(false);
      }),
    );
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Feed</DialogTitle>
          <DialogDescription>Enter the URL of the RSS feed you want to subscribe to.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
        >
          <input
            ref={inputRef}
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/feed.xml"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
          />
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!url.trim() || loading}>
            {loading ? "Adding..." : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FeedItem({
  feed,
  isSelected,
  onSelect,
}: {
  feed: FeedDto;
  isSelected: boolean;
  onSelect: (feedId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(feed.id)}
      className={cn(
        "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm",
        isSelected ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50",
      )}
    >
      <div className="flex items-center gap-2 truncate">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-accent/20 text-[10px] font-medium text-accent">
          {feed.title.charAt(0).toUpperCase()}
        </span>
        <span className="truncate">{feed.title}</span>
      </div>
      {feed.unread_count > 0 && <span className="ml-2 shrink-0 text-muted-foreground">{feed.unread_count}</span>}
    </button>
  );
}

function FolderSection({
  folder,
  feeds,
  isExpanded,
  onToggle,
  selectedFeedId,
  onSelectFeed,
}: {
  folder: FolderDto;
  feeds: FeedDto[];
  isExpanded: boolean;
  onToggle: (folderId: string) => void;
  selectedFeedId: string | null;
  onSelectFeed: (feedId: string) => void;
}) {
  const folderUnread = feeds.reduce((sum, f) => sum + f.unread_count, 0);

  return (
    <Collapsible open={isExpanded}>
      <CollapsibleTrigger
        onClick={() => onToggle(folder.id)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent/50"
      >
        <div className="flex items-center gap-1">
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className="font-medium">{folder.name}</span>
        </div>
        {folderUnread > 0 && <span className="text-muted-foreground">{folderUnread.toLocaleString()}</span>}
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-0.5 pl-3">
          {feeds.map((feed) => (
            <FeedItem key={feed.id} feed={feed} isSelected={selectedFeedId === feed.id} onSelect={onSelectFeed} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

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
        <span className="text-muted-foreground">{totalUnread.toLocaleString()}</span>
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
                  />
                );
              })}
              {unfolderedFeeds.map((feed) => (
                <FeedItem key={feed.id} feed={feed} isSelected={selectedFeedId === feed.id} onSelect={selectFeed} />
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
