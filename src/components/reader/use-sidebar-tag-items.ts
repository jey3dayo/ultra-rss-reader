import { useMemo } from "react";
import type { TagListItemViewModel } from "./tag-list-view";

type UseSidebarTagItemsParams = {
  tags: Array<{ id: string; name: string; color: string | null }> | undefined;
  tagArticleCounts: Record<string, number> | undefined;
  selection: { type: string; tagId?: string };
};

export function useSidebarTagItems({ tags, tagArticleCounts, selection }: UseSidebarTagItemsParams) {
  return useMemo(
    () =>
      (tags ?? []).map(
        (tag): TagListItemViewModel => ({
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
