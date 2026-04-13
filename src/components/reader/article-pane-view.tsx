import { ArticleReaderBody } from "./article-reader-body";
import { ArticleToolbarActionStrip, ArticleToolbarView } from "./article-toolbar-view";
import type { ArticlePaneProps, ArticleToolbarProps } from "./article-view.types";
import { BrowserOverlaySurface } from "./article-view-state";
import { useArticlePaneController } from "./use-article-pane-controller";
import { useArticleToolbarControls } from "./use-article-toolbar-controls";

export function ArticleToolbar({ article, isBrowserOpen, onCloseView, onToggleBrowserOverlay }: ArticleToolbarProps) {
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

export function ArticlePane({ article, feed, feedName }: ArticlePaneProps) {
  const {
    toolbarProps,
    browserOverlayProps,
    browserOverlayActionStripProps,
    showWebPreviewUnavailableWarning,
    webPreviewUnavailableLabel,
    showReaderBody,
    readerBodyProps,
  } = useArticlePaneController({ article, feed, feedName });

  return (
    <div data-testid="article-pane" className="flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar {...toolbarProps} />
      <BrowserOverlaySurface
        {...browserOverlayProps}
        toolbarActions={<ArticleToolbarActionStrip {...browserOverlayActionStripProps} />}
      >
        {showWebPreviewUnavailableWarning ? (
          <div className="border-b border-border bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
            {webPreviewUnavailableLabel}
          </div>
        ) : null}
        {showReaderBody ? (
          <div {...readerBodyProps} className="min-h-0 flex-1" data-testid="article-reader-body">
            <ArticleReaderBody article={article} feedName={feedName} />
          </div>
        ) : (
          <div className="h-full bg-background" />
        )}
      </BrowserOverlaySurface>
    </div>
  );
}
