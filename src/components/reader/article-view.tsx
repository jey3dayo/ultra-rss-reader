import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import { useSetRead } from "@/hooks/use-articles";
import { FeedCleanupPage } from "../feed-cleanup/feed-cleanup-page";
import { ArticleEmptyStateView } from "./article-empty-state-view";
import { ArticleReaderBody } from "./article-reader-body";
import { ArticleToolbarActionStrip, ArticleToolbarView } from "./article-toolbar-view";
import type { ArticlePaneProps } from "./article-view.types";
import {
  ArticleEmptyStateShell,
  ArticleNotFoundStateView,
  BrowserOnlyStateView,
  BrowserOverlaySurface,
} from "./article-view-state";
import { useArticleAutoMark } from "./use-article-auto-mark";
import { useArticleBrowserOverlay } from "./use-article-browser-overlay";
import { useArticleToolbarControls } from "./use-article-toolbar-controls";
import { useArticleViewSelection } from "./use-article-view-selection";
import { useArticleViewUiState } from "./use-article-view-ui-state";

export function ArticleToolbar({
  article,
  isBrowserOpen,
  onCloseView,
  onToggleBrowserOverlay,
}: {
  article: ArticleDto | null;
  isBrowserOpen: boolean;
  onCloseView: () => void;
  onToggleBrowserOverlay: () => void;
}) {
  const actionStripProps = useArticleToolbarControls({
    article,
    isBrowserOpen,
    onToggleBrowserOverlay,
  });

  return (
    <ArticleToolbarView
      showCloseButton={article !== null && !isBrowserOpen}
      hideActionStrip={isBrowserOpen}
      onCloseView={onCloseView}
      hideBrowserOverlayActions={isBrowserOpen}
      {...actionStripProps}
    />
  );
}

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

export function ArticlePane({ article, feed, feedName }: ArticlePaneProps) {
  const { t } = useTranslation("reader");
  const {
    layoutMode,
    contentMode,
    browserUrl,
    clearArticle,
    showToast,
    addRecentlyRead,
    retainArticle,
    viewMode,
    setFocusedPane,
    afterReading,
  } = useArticleViewUiState();
  const { isBrowserOpen, resolvedDisplay, handleCloseBrowserOverlay, handleToggleBrowserOverlay } =
    useArticleBrowserOverlay({
      articleId: article.id,
      articleUrl: article.url,
      browserUrl,
      contentMode,
      feed,
    });
  const actionStripProps = useArticleToolbarControls({
    article,
    isBrowserOpen,
    onToggleBrowserOverlay: handleToggleBrowserOverlay,
    keyboardShortcuts: {
      onToggleBrowserOverlay: handleToggleBrowserOverlay,
      onCloseBrowserOverlay: handleCloseBrowserOverlay,
    },
  });
  const setRead = useSetRead();

  useArticleAutoMark({
    articleId: article.id,
    isRead: article.is_read,
    afterReading,
    viewMode,
    retainArticle,
    addRecentlyRead,
    setRead,
    showToast,
  });

  const handleCloseView = useCallback(() => {
    clearArticle();
    if (layoutMode !== "wide") {
      setFocusedPane("list");
    }
  }, [clearArticle, layoutMode, setFocusedPane]);

  const overlayToolbarActions = (
    <ArticleToolbarActionStrip
      {...actionStripProps}
      labels={{
        ...actionStripProps.labels,
        previewToggleOn: t("web_preview_mode"),
      }}
    />
  );

  return (
    <div data-testid="article-pane" className="flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar
        article={article}
        isBrowserOpen={isBrowserOpen}
        onCloseView={handleCloseView}
        onToggleBrowserOverlay={handleToggleBrowserOverlay}
      />
      <BrowserOverlaySurface
        onCloseOverlay={handleCloseBrowserOverlay}
        showBrowserView={isBrowserOpen}
        toolbarActions={overlayToolbarActions}
      >
        {resolvedDisplay.fallbackReason === "missing_web_preview" ? (
          <div className="border-b border-border bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
            {t("web_preview_unavailable")}
          </div>
        ) : null}
        {resolvedDisplay.readerMode ? (
          <div
            aria-hidden={isBrowserOpen}
            {...(isBrowserOpen ? { inert: true } : {})}
            className="min-h-0 flex-1"
            data-testid="article-reader-body"
          >
            <ArticleReaderBody article={article} feedName={feedName} />
          </div>
        ) : (
          <div className="h-full bg-background" />
        )}
      </BrowserOverlaySurface>
    </div>
  );
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
