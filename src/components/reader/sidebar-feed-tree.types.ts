import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import type {
  FeedTreeFeedViewModel,
  FeedTreeFolderViewModel,
  SidebarFeedTreeViewMode,
} from "@/lib/sidebar/sidebar-feed-tree";
import type { SmartViewKind } from "@/lib/sidebar/smart-view.types";
import type { SortSubscriptions } from "@/schemas/preferences";

type SidebarFeedSelection = { type: "feed"; feedId: string };
type SidebarFolderSelection = { type: "folder"; folderId: string };
type SidebarSmartSelection = { type: "smart"; kind: SmartViewKind };
type SidebarTagSelection = { type: "tag"; tagId: string };
type SidebarAllSelection = { type: "all" };

export type SidebarSelection =
  | SidebarFeedSelection
  | SidebarFolderSelection
  | SidebarSmartSelection
  | SidebarTagSelection
  | SidebarAllSelection;

export type { SidebarFeedTreeViewMode } from "@/lib/sidebar/sidebar-feed-tree";

export type UseSidebarFeedTreeParams = {
  feeds: FeedDto[] | undefined;
  folders: FolderDto[] | undefined;
  selection: SidebarSelection;
  viewMode: SidebarFeedTreeViewMode;
  expandedFolderIds: Set<string>;
  sortSubscriptions: SortSubscriptions;
  grayscaleFavicons: boolean;
  draggedFeedId: string | null;
  starredCountByFeedId?: ReadonlyMap<string, number>;
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
