import type { TFunction } from "i18next";
import { useMemo } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import type { ArticleGroupsViewGroup } from "./article-groups-view";

export type UseArticleListGroupsParams = {
  groupedArticles: Record<string, ArticleDto[]>;
  groupBy: string;
  feedNameMap: Map<string, string>;
  selectedArticleId: string | null;
  recentlyReadIds: Set<string>;
  t: TFunction<"reader">;
};

export function useArticleListGroups({
  groupedArticles,
  groupBy,
  feedNameMap,
  selectedArticleId,
  recentlyReadIds,
  t,
}: UseArticleListGroupsParams): ArticleGroupsViewGroup[] {
  return useMemo(() => {
    return Object.entries(groupedArticles).map(([groupLabel, groupArticles]) => ({
      id: groupLabel,
      label:
        groupLabel === "TODAY"
          ? t("today")
          : groupLabel === "YESTERDAY"
            ? t("yesterday")
            : groupLabel === "__unknown_feed__"
              ? t("unknown_feed")
              : groupLabel,
      showLabel: groupBy !== "none",
      items: groupArticles.map((article) => ({
        article,
        feedName: feedNameMap.get(article.feed_id),
        isSelected: selectedArticleId === article.id,
        isRecentlyRead: recentlyReadIds.has(article.id),
      })),
    }));
  }, [feedNameMap, groupBy, groupedArticles, recentlyReadIds, selectedArticleId, t]);
}
