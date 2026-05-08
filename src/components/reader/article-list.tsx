import { useArticleListController } from "@/components/reader/hooks/article-list/use-article-list-controller";
import { ARTICLE_LIST_PANE_WIDTH_PX } from "@/constants/ui-layout";
import { cn } from "@/lib/utils";
import { ArticleListBody } from "./article-list-body";
import { ArticleListContextStrip } from "./article-list-context-strip";
import { ArticleListFooter } from "./article-list-footer";
import { ArticleListHeader } from "./article-list-header";

export function ArticleList() {
  const { layoutMode, headerProps, contextStripProps, bodyProps, footerProps } = useArticleListController();

  return (
    <div
      data-article-list-pane="true"
      className={cn(
        "flex h-full flex-col border-r border-[var(--subscriptions-pane-divider)] bg-[var(--reader-list-pane-surface)]",
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
