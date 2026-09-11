import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";
import type { ActiveDropTarget } from "@/lib/sidebar/feed-tree-drag.types";
import type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "@/lib/sidebar/sidebar-feed-tree";
import type { SidebarDensity } from "./sidebar-density";

export type { ActiveDropTarget } from "@/lib/sidebar/feed-tree-drag.types";
export type { FeedTreeFeedViewModel, FeedTreeFolderViewModel } from "@/lib/sidebar/sidebar-feed-tree";

/**
 * Presence-augmented view models produced by `useFeedTreePresence`
 * (src/components/reader/hooks/sidebar/use-feed-tree-presence.ts). Declared
 * here (rather than in the hook module) so both the hook and the row/folder
 * render components can import them without a circular dependency, since
 * the hook itself imports `FeedTreeFeedViewModel` / `FeedTreeFolderViewModel`
 * from this file.
 */
// Module-local: only the two composed view models below are part of the
// reader public type surface, so exporting this building block on its own
// would add an unreferenced public contract.
type FeedTreePresenceLeavingFlag = { isLeaving: boolean };

export type FeedTreePresenceFeedViewModel = FeedTreeFeedViewModel & FeedTreePresenceLeavingFlag;

export type FeedTreePresenceFolderViewModel = Omit<FeedTreeFolderViewModel, "feeds"> &
  FeedTreePresenceLeavingFlag & {
    feeds: FeedTreePresenceFeedViewModel[];
  };

export type FeedTreeEmptyState =
  | { kind: "hidden"; text?: never; message?: never; label?: never }
  | { kind: "message"; text: string; message?: never; label?: never }
  | { kind: "loading"; text: string; message?: never; label?: never }
  | { kind: "action"; text: string; onAction: () => void; message?: never; label?: never }
  | { kind: "message"; message: string; text?: never; label?: never }
  | { kind: "loading"; label: string; text?: never; message?: never }
  | { kind: "action"; label: string; onAction: () => void; text?: never; message?: never };

export type FeedTreeViewProps = {
  isOpen: boolean;
  sidebarDensity?: SidebarDensity;
  folders: FeedTreeFolderViewModel[];
  unfolderedFeeds: FeedTreeFeedViewModel[];
  unfolderedLabel?: string;
  /**
   * Identifies the logical scope (e.g. account + view mode) for
   * `useFeedTreePresence`. Changing it discards any retained "leaving" rows
   * immediately instead of carrying a stale account's exit animation into
   * the next one. Optional so existing call sites that never switch scope
   * (tests, stories) can omit it; `FeedTreeView` falls back to a stable
   * constant scope in that case.
   */
  scopeKey?: string;
  onToggleFolder: (folderId: string) => void;
  onSelectFolder?: (folderId: string) => void;
  onSelectFeed: (feedId: string) => void;
  onMarkFeedRead?: (feed: FeedTreeFeedViewModel) => void;
  onMarkFolderRead?: (folder: FeedTreeFolderViewModel) => void;
  displayFavicons: boolean;
  emptyState: FeedTreeEmptyState;
  renderFolderContextMenu?: (folder: FeedTreeFolderViewModel) => ReactNode;
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
  canDragFeeds?: boolean;
  draggedFeedId?: string | null;
  activeDropTarget?: ActiveDropTarget;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onDragEnterFolder?: (folderId: string) => void;
  onDragEnterUnfoldered?: () => void;
  onDropToFolder?: (folderId: string) => void;
  onDropToUnfoldered?: () => void;
  onDragEnd?: () => void;
};

export type FeedTreeRowProps = {
  sidebarDensity?: SidebarDensity;
  feed: FeedTreePresenceFeedViewModel;
  displayFavicons: boolean;
  onSelectFeed: (feedId: string) => void;
  onMarkFeedRead?: FeedTreeViewProps["onMarkFeedRead"];
  renderFeedContextMenu?: (feed: FeedTreeFeedViewModel) => ReactNode;
  canDragFeeds?: boolean;
  isDragged?: boolean;
  onDragStartFeed?: (feed: FeedTreeFeedViewModel) => void;
  onPointerDownFeed?: (feed: FeedTreeFeedViewModel, event: ReactPointerEvent<HTMLButtonElement>) => void;
  consumeSuppressedHandleClick?: () => boolean;
};
