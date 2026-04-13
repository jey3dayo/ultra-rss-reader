import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import type { FeedTreeViewProps } from "./feed-tree-view";
import type { SidebarFeedTreeViewMode, SidebarSelection } from "./sidebar-feed-tree.types";
import type { StartupFolderExpansionMode } from "./use-sidebar-startup-folder-expansion";

export type SidebarFeedTreeProps = Omit<FeedTreeViewProps, "emptyState" | "unfolderedLabel">;

export type SidebarFeedSectionParams = {
  selectedAccountId: string | null;
  feeds: FeedDto[] | undefined;
  folders: FolderDto[] | undefined;
  selection: SidebarSelection;
  viewMode: SidebarFeedTreeViewMode;
  expandedFolderIds: Set<string>;
  sortSubscriptions: string;
  grayscaleFavicons: boolean;
  isFeedsSectionOpen: boolean;
  startupFolderExpansion: StartupFolderExpansionMode;
  showSidebarUnread: boolean;
  showSidebarStarred: boolean;
  showSidebarTags: boolean;
  setExpandedFolders: (folderIds: Iterable<string>) => void;
  selectFeed: (feedId: string) => void;
  selectFolder: (folderId: string) => void;
  selectAll: () => void;
  selectSmartView: (kind: "unread" | "starred") => void;
  setViewMode: (mode: SidebarFeedTreeViewMode) => void;
  toggleFolder: (folderId: string) => void;
  displayFavicons: boolean;
  moveFeedToFolder: (feedId: string, folderId: string) => Promise<unknown>;
  moveFeedToUnfoldered: (feedId: string) => Promise<unknown>;
  renderFolderContextMenu?: FeedTreeViewProps["renderFolderContextMenu"];
  renderFeedContextMenu?: FeedTreeViewProps["renderFeedContextMenu"];
};

export type SidebarFeedTreePropsParams = {
  isFeedsSectionOpen: boolean;
  feedTreeFolders: FeedTreeViewProps["folders"];
  unfolderedFeedViews: FeedTreeViewProps["unfolderedFeeds"];
  toggleFolder: FeedTreeViewProps["onToggleFolder"];
  selectFolder: FeedTreeViewProps["onSelectFolder"];
  selectFeed: FeedTreeViewProps["onSelectFeed"];
  displayFavicons: FeedTreeViewProps["displayFavicons"];
  canDragFeeds: boolean;
  draggedFeedId: FeedTreeViewProps["draggedFeedId"];
  activeDropTarget: FeedTreeViewProps["activeDropTarget"];
  handleDragStartFeed: (feedId: string) => void;
  handleDragEnterFolder: NonNullable<FeedTreeViewProps["onDragEnterFolder"]>;
  handleDragEnterUnfoldered: NonNullable<FeedTreeViewProps["onDragEnterUnfoldered"]>;
  handleDropToFolder: (folderId: string) => Promise<unknown>;
  handleDropToUnfoldered: () => Promise<unknown>;
  clearDragState: NonNullable<FeedTreeViewProps["onDragEnd"]>;
  renderFolderContextMenu?: FeedTreeViewProps["renderFolderContextMenu"];
  renderFeedContextMenu?: FeedTreeViewProps["renderFeedContextMenu"];
};

export type SidebarFeedSectionResult = {
  feedTreeProps: SidebarFeedTreeProps;
};
