"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, RefreshCw, Plus, Settings } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { folders, feeds, type Feed, type Folder } from "@/lib/mock-data"

interface SidebarProps {
  selectedFeed: string | null
  onSelectFeed: (feedId: string | null) => void
  onOpenSettings: () => void
  totalUnread: number
}

export function Sidebar({
  selectedFeed,
  onSelectFeed,
  onOpenSettings,
  totalUnread,
}: SidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(
    folders.reduce((acc, folder) => ({ ...acc, [folder.id]: folder.isExpanded }), {})
  )

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }))
  }

  const getFeedsInFolder = (folderId: string): Feed[] => {
    return feeds.filter((feed) => feed.folderId === folderId)
  }

  const getFolderUnreadCount = (folderId: string): number => {
    return getFeedsInFolder(folderId).reduce((sum, feed) => sum + feed.unreadCount, 0)
  }

  return (
    <div className="flex h-full w-[280px] flex-col bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-red-500" />
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-yellow-500" />
          <div className="flex h-3 w-3 items-center justify-center rounded-full bg-green-500" />
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button className="rounded p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Account Name */}
      <div className="px-4 pb-1">
        <h1 className="text-xl font-semibold text-sidebar-foreground">FreshRSS</h1>
        <p className="text-xs text-muted-foreground">Today at 2:54</p>
      </div>

      {/* Unread Section */}
      <button
        onClick={() => onSelectFeed(null)}
        className={cn(
          "mx-2 my-1 flex items-center justify-between rounded-md px-2 py-2 text-sm",
          selectedFeed === null
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "hover:bg-sidebar-accent/50"
        )}
      >
        <span className="font-medium">Unread</span>
        <span className="text-muted-foreground">{totalUnread.toLocaleString()}</span>
      </button>

      {/* Folders Section */}
      <div className="px-2 py-2">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-sm font-medium text-sidebar-foreground">Folders</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Scrollable Feed List */}
      <ScrollArea className="flex-1">
        <div className="space-y-0.5 px-2 pb-4">
          {folders.map((folder) => {
            const folderFeeds = getFeedsInFolder(folder.id)
            const folderUnread = getFolderUnreadCount(folder.id)
            const isExpanded = expandedFolders[folder.id]

            if (folderFeeds.length === 0) return null

            return (
              <Collapsible
                key={folder.id}
                open={isExpanded}
                onOpenChange={() => toggleFolder(folder.id)}
              >
                <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent/50">
                  <div className="flex items-center gap-1.5">
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="font-medium">{folder.name}</span>
                  </div>
                  <span className="text-muted-foreground">{folderUnread}</span>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="ml-2 space-y-0.5 border-l border-sidebar-border pl-2">
                    {folderFeeds.map((feed) => (
                      <button
                        key={feed.id}
                        onClick={() => onSelectFeed(feed.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm",
                          selectedFeed === feed.id
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "hover:bg-sidebar-accent/50"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-accent/20 text-[10px] font-medium text-accent">
                            {feed.icon}
                          </span>
                          <span className="truncate">{feed.name}</span>
                        </div>
                        <span className="ml-2 shrink-0 text-muted-foreground">
                          {feed.unreadCount}
                        </span>
                      </button>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </div>
      </ScrollArea>

      {/* Bottom Toolbar */}
      <div className="border-t border-sidebar-border p-2">
        <button
          onClick={onOpenSettings}
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </button>
      </div>
    </div>
  )
}
