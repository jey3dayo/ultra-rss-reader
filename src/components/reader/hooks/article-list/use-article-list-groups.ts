import type { TFunction } from "i18next";
import { useMemo } from "react";
import type { ArticleDto } from "@/api/tauri-commands";
import { buildArticleGroupItems, resolveArticleGroupLabelToken } from "@/lib/articles/article-list";
import type { ArticleGroupsViewGroup } from "../../article-groups-view";

type UseArticleListGroupsParams = {
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
