import { ARTICLE_LIST_PANE_WIDTH_PX } from "@/constants/ui-layout";
import { cn } from "@/lib/utils";
import { ArticleListBody } from "./article-list-body";
import { ArticleListContextStrip } from "./article-list-context-strip";
import { ArticleListFooter } from "./article-list-footer";
import { ArticleListHeader } from "./article-list-header";
import { useArticleListController } from "./use-article-list-controller";

export function ArticleList() {
  const { layoutMode, headerProps, contextStripProps, bodyProps, footerProps } = useArticleListController();

  return (
    <div
      className={cn(
        "flex h-full flex-col border-r border-border bg-card",
        layoutMode === "mobile" ? "w-full" : undefined,
      )}
      style={layoutMode === "mobile" ? undefined : { width: `${ARTICLE_LIST_PANE_WIDTH_PX}px` }}
    >
      <ArticleListHeader {...headerProps} />
      <ArticleListContextStrip {...contextStripProps} />
      <ArticleListBody {...bodyProps} />
      <ArticleListFooter {...footerProps} />
    </div>
  );
}
