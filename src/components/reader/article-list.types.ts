import type { ComponentProps } from "react";
import type { ArticleListBody } from "./article-list-body";
import type { ArticleListContextStrip } from "./article-list-context-strip";
import type { ArticleListFooter } from "./article-list-footer";
import type { ArticleListHeader } from "./article-list-header";

export type ArticleListLayoutMode = "wide" | "compact" | "mobile";
export type ArticleListViewMode = "all" | "unread" | "starred";

export type ArticleListHeaderProps = ComponentProps<typeof ArticleListHeader>;
export type ArticleListContextStripProps = ComponentProps<typeof ArticleListContextStrip>;
export type ArticleListBodyProps = ComponentProps<typeof ArticleListBody>;
export type ArticleListFooterProps = ComponentProps<typeof ArticleListFooter>;

export type UseArticleListViewPropsResult = {
  layoutMode: ArticleListLayoutMode;
  headerProps: ArticleListHeaderProps;
  contextStripProps: ArticleListContextStripProps;
  bodyProps: ArticleListBodyProps;
  footerProps: ArticleListFooterProps;
};
