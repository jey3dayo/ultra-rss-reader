import { useMemo } from "react";
import type { TagDto } from "@/api/tauri-commands";
import type { SidebarSelection } from "../../sidebar-feed-tree.types";

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
  selection: SidebarSelection;
};

export type SidebarTagItemsResult = SidebarTagItem[];

export function useSidebarTagItems({
  tags,
  tagArticleCounts,
  selection,
}: SidebarTagItemsParams): SidebarTagItemsResult {
  return useMemo(
    () =>
      (tags ?? []).map(
        (tag): SidebarTagItem => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          articleCount: tagArticleCounts?.[tag.id] ?? 0,
          isSelected: selection.type === "tag" && selection.tagId === tag.id,
        }),
      ),
    [selection, tagArticleCounts, tags],
  );
}
