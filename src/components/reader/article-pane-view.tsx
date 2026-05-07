import {
  MOTION_ARTICLE_SLIDE_CLASS_NAME,
  MOTION_DATA_DIRECTION_ATTRIBUTE,
  MOTION_DIRECTION_NEUTRAL,
  MOTION_DIRECTION_NEXT,
  MOTION_DIRECTION_PREV,
  type MotionDirection,
} from "@/constants/motion";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
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
  const focusedPane = useUiStore((state) => state.focusedPane);
  const articleNavigationDirection = useUiStore((state) => state.articleNavigationDirection);
  const motionDirection: MotionDirection =
    articleNavigationDirection === 1
      ? MOTION_DIRECTION_NEXT
      : articleNavigationDirection === -1
        ? MOTION_DIRECTION_PREV
        : MOTION_DIRECTION_NEUTRAL;
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

  return (
    <div
      data-testid="article-pane"
      data-article-content-pane="true"
      data-active-pane={focusedPane === "content" ? "true" : "false"}
      tabIndex={-1}
      className={cn(
        "typography-lane-reader flex h-full flex-1 flex-col bg-background outline-none transition-[background-color,box-shadow] duration-150 motion-reduce:transition-none",
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
          <div
            {...readerBodyStateProps}
            {...{ [MOTION_DATA_DIRECTION_ATTRIBUTE]: motionDirection }}
            className={cn("min-h-0 flex-1", MOTION_ARTICLE_SLIDE_CLASS_NAME)}
            data-testid="article-reader-body"
          >
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
