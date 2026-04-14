import type { ReactNode } from "react";
import type { TagDto } from "@/api/tauri-commands";
import type { UiSelection } from "@/stores/ui-store";
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
  selection: UiSelection;
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
};
