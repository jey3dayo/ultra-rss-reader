import type { ReactNode } from "react";
import type { TagDto } from "@/api/tauri-commands";
import type { ReaderSelection } from "@/lib/reader/reader-selection.types";
import type { SidebarDensity } from "./sidebar-density";

export type SidebarTagItem = {
  id: string;
  name: string;
  color: string | null;
  articleCount: number;
  isSelected: boolean;
};

export type SidebarTagItemsParams = {
  tags: TagDto[] | undefined;
  tagArticleCounts: Record<string, number> | undefined;
  selection: ReaderSelection;
};

export type SidebarTagItemsResult = SidebarTagItem[];

export type SidebarTagListProps = {
  tagsLabel: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  sidebarDensity?: SidebarDensity;
  tags: SidebarTagItemsResult;
  onSelectTag: (tagId: string) => void;
  renderContextMenu?: (tag: SidebarTagItem) => ReactNode;
  renderTagSectionContextMenu?: () => ReactNode;
};
