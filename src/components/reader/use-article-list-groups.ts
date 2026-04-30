import { useMemo } from "react";
import { buildArticleGroupItems, resolveArticleGroupLabelToken } from "@/lib/article-list";
import type { ArticleGroupsViewGroup } from "./article-groups-view";
import type { UseArticleListGroupsParams } from "./article-list.types";

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
      label: (() => {
        const labelToken = resolveArticleGroupLabelToken(groupLabel);
        return labelToken ? t(labelToken) : groupLabel;
      })(),
      showLabel: groupBy !== "none",
      items: buildArticleGroupItems({
        articles: groupArticles,
        feedNameMap,
        selectedArticleId,
        recentlyReadIds,
      }),
    }));
  }, [feedNameMap, groupBy, groupedArticles, recentlyReadIds, selectedArticleId, t]);
}
