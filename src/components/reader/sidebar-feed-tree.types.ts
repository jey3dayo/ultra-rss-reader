import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import type { UiSelection } from "@/stores/ui-store";
import type { FeedTreeFolderViewModel } from "./feed-tree-folder-section";
import type { FeedTreeFeedViewModel } from "./feed-tree-row";

export type SidebarSelection = UiSelection;

export type SidebarFeedTreeViewMode = "all" | "unread" | "starred";

export type UseSidebarFeedTreeParams = {
  feeds: FeedDto[] | undefined;
  folders: FolderDto[] | undefined;
  selection: SidebarSelection;
  viewMode: SidebarFeedTreeViewMode;
  expandedFolderIds: Set<string>;
  sortSubscriptions: string;
  grayscaleFavicons: boolean;
  draggedFeedId: string | null;
};

export type UseSidebarFeedTreeResult = {
  feedById: Map<string, FeedDto>;
  feedList: FeedDto[];
  folderList: FolderDto[];
  sortedFolderList: FolderDto[];
  selectedFeedId: string | null;
  selectedFolderId: string | null;
  feedTreeFolders: FeedTreeFolderViewModel[];
  unfolderedFeedViews: FeedTreeFeedViewModel[];
  orderedFeedIds: string[];
};
