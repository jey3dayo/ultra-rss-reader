import { cn } from "cn";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { useArticlePaneController } from "@/components/reader/hooks/article/use-article-pane-controller";
import { useArticleToolbarControls } from "@/components/reader/hooks/article/use-article-toolbar-controls";
import { useUiStore } from "@/stores/ui-store";
import { ArticleContextMenu } from "./article-context-menu";
import { ArticleReaderBody } from "./article-reader-body";
import { ArticleToolbarView } from "./article-toolbar-view";
import { BrowserOverlaySurface } from "./article-view-state";
import { useReaderPassiveLayoutBodyRef } from "./hooks/use-reader-passive-layout-context";

export type ArticlePaneProps = {
  article: ArticleDto;
  feed?: FeedDto;
  feedName?: string;
  hasNextArticle?: boolean;
};

export type ArticlePaneToolbarState = {
  article: ArticleDto | null;
  isBrowserOpen: boolean;
  onCloseView: () => void;
  onToggleBrowserOverlay: () => void;
};

export function ArticleToolbar({
  article,
  isBrowserOpen,
  onCloseView,
  onToggleBrowserOverlay,
}: ArticlePaneToolbarState) {
  const actionStripProps = useArticleToolbarControls({
    article,
    isBrowserOpen,
    onToggleBrowserOverlay,
  });

  if (isBrowserOpen) {
    return null;
  }

  return (
    <ArticleToolbarView
      showCloseButton={article !== null}
      hideActionStrip={false}
      onCloseView={onCloseView}
      {...actionStripProps}
      articleState={{
        ...actionStripProps.articleState,
        hideBrowserOverlayActions: false,
      }}
    />
  );
}

export function ArticlePane({ article, feed, feedName, hasNextArticle = true }: ArticlePaneProps) {
  const focusedPane = useUiStore((state) => state.focusedPane);
  const {
    toolbarProps,
    browserOverlayProps,
    browserOverlayToolbarActions,
    showWebPreviewUnavailableWarning,
    webPreviewUnavailableLabel,
    showReaderBody,
    readerBodyProps,
  } = useArticlePaneController({ article, feed, feedName });
  const { onOpenArticleTitleInWebPreview, ...readerBodyStateProps } = readerBodyProps;
  const bodyRef = useReaderPassiveLayoutBodyRef("content");

  return (
    <section
      data-testid="article-pane"
      data-article-content-pane="true"
      data-active-pane={focusedPane === "content" ? "true" : "false"}
      aria-label={article.title}
      tabIndex={-1}
      className={cn(
        "typography-lane-reader flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background outline-none transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none",
        focusedPane === "content" &&
          "bg-[linear-gradient(90deg,var(--background)_0%,color-mix(in_srgb,var(--sidebar-hover-surface)_24%,var(--background))_100%)]",
      )}
    >
      <ArticleToolbar {...toolbarProps} />
      <BrowserOverlaySurface {...browserOverlayProps} toolbarActions={browserOverlayToolbarActions}>
        {showWebPreviewUnavailableWarning ? (
          <div className="border-b border-border bg-state-warning-surface px-4 py-2 text-sm text-state-warning-foreground">
            {webPreviewUnavailableLabel}
          </div>
        ) : null}
        {showReaderBody ? (
          <ArticleContextMenu
            article={article}
            sourceFeed={feed}
            triggerClassName="h-full min-h-0 flex-1 overflow-hidden"
          >
            <div
              ref={bodyRef}
              {...readerBodyStateProps}
              className="h-full min-h-0 flex-1 overflow-hidden"
              data-testid="article-reader-body"
            >
              <ArticleReaderBody
                article={article}
                feed={feed}
                feedName={feedName}
                onOpenArticleTitleInWebPreview={onOpenArticleTitleInWebPreview}
                hasNextArticle={hasNextArticle}
              />
            </div>
          </ArticleContextMenu>
        ) : (
          <div className="h-full bg-background" />
        )}
      </BrowserOverlaySurface>
    </section>
  );
}
