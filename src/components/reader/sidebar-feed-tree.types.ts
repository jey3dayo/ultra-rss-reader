import type { FeedDto, FolderDto } from "@/api/tauri-commands";
import type { UiSelection } from "@/stores/ui-store";

export type SidebarSelection = UiSelection;

export type UseSidebarFeedTreeParams = {
  feeds: FeedDto[] | undefined;
  folders: FolderDto[] | undefined;
  selection: SidebarSelection;
  viewMode: "all" | "unread" | "starred";
  expandedFolderIds: Set<string>;
  sortSubscriptions: string;
  grayscaleFavicons: boolean;
  draggedFeedId: string | null;
};
