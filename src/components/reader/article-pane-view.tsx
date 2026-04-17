import { ArticleReaderBody } from "./article-reader-body";
import { ArticleToolbarView } from "./article-toolbar-view";
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
  const { onOpenArticleTitleInWebPreview, ...readerBodyStateProps } = readerBodyProps;

  return (
    <div data-testid="article-pane" className="typography-lane-reader flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar {...toolbarProps} />
      <BrowserOverlaySurface
        {...browserOverlayProps}
        toolbarActions={(overlayActionRenderer) =>
          browserOverlayActionStripProps.shareMenuControl
            ? overlayActionRenderer.renderAction(browserOverlayActionStripProps.shareMenuControl, { key: "share-menu" })
            : null
        }
      >
        {showWebPreviewUnavailableWarning ? (
          <div className="border-b border-border bg-state-warning-surface px-4 py-2 text-sm text-state-warning-foreground">
            {webPreviewUnavailableLabel}
          </div>
        ) : null}
        {showReaderBody ? (
          <div {...readerBodyStateProps} className="min-h-0 flex-1" data-testid="article-reader-body">
            <ArticleReaderBody
              article={article}
              feedName={feedName}
              onOpenArticleTitleInWebPreview={onOpenArticleTitleInWebPreview}
            />
          </div>
        ) : (
          <div className="h-full bg-background" />
        )}
      </BrowserOverlaySurface>
    </div>
  );
}
