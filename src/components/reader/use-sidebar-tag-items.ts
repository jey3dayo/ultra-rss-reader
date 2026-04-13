import { useMemo } from "react";
import type { SidebarTagItem, SidebarTagItemsParams, SidebarTagItemsResult } from "./sidebar-tag-items.types";

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
