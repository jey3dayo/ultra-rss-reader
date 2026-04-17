import { lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { ArticleEmptyStateView } from "./article-empty-state-view";
import { ArticlePane, ArticleToolbar } from "./article-pane-view";
import { ArticleEmptyStateShell, ArticleNotFoundStateView, BrowserOnlyStateView } from "./article-view-state";
import { useArticleViewSelection } from "./use-article-view-selection";
import { useArticleViewUiState } from "./use-article-view-ui-state";

const LazyFeedCleanupPage = lazy(async () => {
  const mod = await import("../feed-cleanup/feed-cleanup-page");
  return { default: mod.FeedCleanupPage };
});

const LazySubscriptionsIndexPage = lazy(async () => {
  const mod = await import("../subscriptions-index/subscriptions-index-page");
  return { default: mod.SubscriptionsIndexPage };
});

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
          hints={[t("empty_state_search_hint"), t("empty_state_web_preview_hint")]}
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

  if (selectionState.kind === "subscriptions-index") {
    return (
      <Suspense fallback={null}>
        <LazySubscriptionsIndexPage />
      </Suspense>
    );
  }

  if (selectionState.kind === "feed-cleanup") {
    return (
      <Suspense fallback={null}>
        <LazyFeedCleanupPage />
      </Suspense>
    );
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
