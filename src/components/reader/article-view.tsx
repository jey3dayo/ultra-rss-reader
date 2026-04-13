import { useTranslation } from "react-i18next";
import { FeedCleanupPage } from "../feed-cleanup/feed-cleanup-page";
import { ArticleEmptyStateView } from "./article-empty-state-view";
import { ArticlePane, ArticleToolbar } from "./article-pane-view";
import { ArticleEmptyStateShell, ArticleNotFoundStateView, BrowserOnlyStateView } from "./article-view-state";
import { useArticleViewSelection } from "./use-article-view-selection";
import { useArticleViewUiState } from "./use-article-view-ui-state";

export { ArticlePane, ArticleToolbar } from "./article-pane-view";

function EmptyState() {
  const { t } = useTranslation("reader");
  return (
    <ArticleEmptyStateShell
      toolbar={
        <ArticleToolbar article={null} isBrowserOpen={false} onCloseView={() => {}} onToggleBrowserOverlay={() => {}} />
      }
      body={
        <ArticleEmptyStateView
          message={t("select_article_to_read")}
          hints={[t("empty_state_pick_from_list"), t("empty_state_search_hint"), t("empty_state_web_preview_hint")]}
        />
      }
    />
  );
}

function BrowserOnlyState() {
  const { closeBrowser } = useArticleViewUiState();

  return <BrowserOnlyStateView onCloseOverlay={closeBrowser} />;
}

export function ArticleView() {
  const { t } = useTranslation("reader");
  const selectionState = useArticleViewSelection();

  if (selectionState.kind === "feed-cleanup") {
    return <FeedCleanupPage />;
  }

  if (selectionState.kind === "browser-only") {
    return <BrowserOnlyState />;
  }

  if (selectionState.kind === "empty") {
    return <EmptyState />;
  }

  if (selectionState.kind === "not-found") {
    return <ArticleNotFoundStateView message={t("article_not_found")} />;
  }

  return (
    <ArticlePane article={selectionState.article} feed={selectionState.feed} feedName={selectionState.feed?.title} />
  );
}
