import { useMemo } from "react";
import type { TagDto } from "@/api/tauri-commands";
import type { ReaderSelection } from "@/lib/reader/reader-selection.types";

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
