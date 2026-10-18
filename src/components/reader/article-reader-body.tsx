import { ChevronDownIcon } from "lucide-react";
import { type KeyboardEvent, useCallback, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { IconToolbarSurfaceButton, ScrollArea } from "@/design-system";
import { executeAction } from "@/lib/actions";
import {
  formatArticleDate,
  resolveArticleDateLocale,
  resolveArticleSummaryWebsiteHref,
  resolveArticleSummaryWebsiteLabel,
} from "@/lib/articles/article-view";
import { fromSanitizedArticleHtml } from "@/lib/content/html";
import { useUiStore } from "@/stores/ui-store";
import { ArticleContentView } from "./article-content-view";
import { ArticleMetaView } from "./article-meta-view";
import { ArticleTagChips } from "./article-tag-chips";
import { useReaderLinkRouting } from "./hooks/use-reader-link-routing";

type ArticleReaderBodyProps = {
  article: ArticleDto;
  feed?: FeedDto;
  feedName?: string;
  onOpenArticleTitleInWebPreview?: () => void;
  hasNextArticle?: boolean;
};

const ARTICLE_READER_SCROLL_POSITION_COMMIT_DELAY_MS = 120;
const WHEEL_DELTA_LINE_HEIGHT_PX = 40;
const READER_KEYBOARD_SCROLL_MIN_PX = 72;

function getReaderScrollDirection(event: KeyboardEvent<HTMLDivElement>): 1 | -1 | null {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return null;
  }

  if (event.key === "ArrowDown") {
    return 1;
  }

  if (event.key === "ArrowUp") {
    return -1;
  }

  if (event.key === " ") {
    return event.shiftKey ? -1 : 1;
  }

  return null;
}

function normalizeWheelDeltaY(event: globalThis.WheelEvent, viewport: HTMLDivElement): number {
  if (event.deltaMode === globalThis.WheelEvent.DOM_DELTA_LINE) {
    return event.deltaY * WHEEL_DELTA_LINE_HEIGHT_PX;
  }

  if (event.deltaMode === globalThis.WheelEvent.DOM_DELTA_PAGE) {
    return event.deltaY * viewport.clientHeight;
  }

  return event.deltaY;
}

export function ArticleReaderBody({
  article,
  feed,
  feedName,
  onOpenArticleTitleInWebPreview,
  hasNextArticle = true,
}: ArticleReaderBodyProps) {
  const { t, i18n } = useTranslation("reader");
  const { openReaderLink, readerLinkTitle } = useReaderLinkRouting(article.id);
  const selectFeedFromCurrentContext = useUiStore((s) => s.selectFeedFromCurrentContext);
  const setArticleReaderScrollPosition = useUiStore((s) => s.setArticleReaderScrollPosition);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentContainerRef = useRef<HTMLDivElement | null>(null);
  const contentContainerClickListenerRef = useRef<((event: globalThis.MouseEvent) => void) | null>(null);
  const contentContainerEventHandlerRef = useRef<(event: globalThis.MouseEvent) => void>(
    (event: globalThis.MouseEvent) => {
      contentContainerClickListenerRef.current?.(event);
    },
  );
  const currentArticleIdRef = useRef(article.id);
  const pendingScrollPositionRef = useRef<{ articleId: string; scrollTop: number } | null>(null);
  const scrollPositionCommitTimerRef = useRef<number | null>(null);
  const articleUrl = article.url;
  const siteHref = feed ? resolveArticleSummaryWebsiteHref(feed) : null;
  const siteLabel = feed ? resolveArticleSummaryWebsiteLabel(feed) : null;
  const siteLink =
    siteHref && siteLabel
      ? {
          href: siteHref,
          label: siteLabel,
          title: readerLinkTitle(siteHref),
          onOpen: openReaderLink,
        }
      : null;
  const articleContentHtml = fromSanitizedArticleHtml(article.content_sanitized);

  const clearPendingScrollPositionCommit = useCallback(() => {
    if (scrollPositionCommitTimerRef.current !== null) {
      window.clearTimeout(scrollPositionCommitTimerRef.current);
      scrollPositionCommitTimerRef.current = null;
    }
  }, []);

  const commitPendingScrollPosition = useCallback(() => {
    scrollPositionCommitTimerRef.current = null;
    const pending = pendingScrollPositionRef.current;
    if (!pending) {
      return false;
    }

    pendingScrollPositionRef.current = null;
    setArticleReaderScrollPosition(pending.articleId, pending.scrollTop);
    return true;
  }, [setArticleReaderScrollPosition]);

  const flushPendingScrollPosition = useCallback(() => {
    clearPendingScrollPositionCommit();
    return commitPendingScrollPosition();
  }, [clearPendingScrollPositionCommit, commitPendingScrollPosition]);

  const scheduleScrollPositionCommit = useCallback(
    (articleId: string, scrollTop: number) => {
      pendingScrollPositionRef.current = { articleId, scrollTop };
      clearPendingScrollPositionCommit();
      scrollPositionCommitTimerRef.current = window.setTimeout(
        commitPendingScrollPosition,
        ARTICLE_READER_SCROLL_POSITION_COMMIT_DELAY_MS,
      );
    },
    [clearPendingScrollPositionCommit, commitPendingScrollPosition],
  );

  const handleReaderWheel = useCallback(
    (event: globalThis.WheelEvent) => {
      if (event.ctrlKey || event.metaKey || event.deltaY === 0) {
        return;
      }

      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      const previousScrollTop = viewport.scrollTop;
      viewport.scrollTop += normalizeWheelDeltaY(event, viewport);
      if (viewport.scrollTop === previousScrollTop) {
        return;
      }

      event.preventDefault();
      scheduleScrollPositionCommit(article.id, viewport.scrollTop);
    },
    [article.id, scheduleScrollPositionCommit],
  );

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const previousArticleId = currentArticleIdRef.current;

    if (previousArticleId === article.id) {
      return;
    }

    currentArticleIdRef.current = article.id;
    if (!viewport) {
      return;
    }

    const didFlushPendingScrollPosition = flushPendingScrollPosition();
    if (!didFlushPendingScrollPosition) {
      setArticleReaderScrollPosition(previousArticleId, viewport.scrollTop);
    }
    viewport.scrollTop = useUiStore.getState().articleReaderScrollPositions.get(article.id) ?? 0;
  }, [article.id, flushPendingScrollPosition, setArticleReaderScrollPosition]);

  useLayoutEffect(() => {
    currentArticleIdRef.current = article.id;
  }, [article.id]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const handleScroll = () => scheduleScrollPositionCommit(currentArticleIdRef.current, viewport.scrollTop);

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    viewport.addEventListener("wheel", handleReaderWheel, { passive: false });
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
      viewport.removeEventListener("wheel", handleReaderWheel);
      // clearArticle() prunes the closed article's scroll entry; the unmount cleanup
      // that follows must not write the position back and undo that pruning.
      if (useUiStore.getState().selectedArticleId !== currentArticleIdRef.current) {
        clearPendingScrollPositionCommit();
        pendingScrollPositionRef.current = null;
        return;
      }
      const didFlushPendingScrollPosition = flushPendingScrollPosition();
      if (!didFlushPendingScrollPosition) {
        setArticleReaderScrollPosition(currentArticleIdRef.current, viewport.scrollTop);
      }
    };
  }, [
    clearPendingScrollPositionCommit,
    flushPendingScrollPosition,
    handleReaderWheel,
    scheduleScrollPositionCommit,
    setArticleReaderScrollPosition,
  ]);

  useLayoutEffect(() => {
    contentContainerClickListenerRef.current = (event: globalThis.MouseEvent) => {
      const contentContainer = contentContainerRef.current;
      if (!contentContainer) {
        return;
      }

      if (event.type === "auxclick" && event.button !== 1) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !contentContainer.contains(anchor)) {
        return;
      }

      event.preventDefault();
      openReaderLink(
        anchor.getAttribute("href") ?? "",
        { external: event.metaKey || event.ctrlKey || event.button === 1 },
        articleUrl,
      );
    };
  });

  const setContentContainerElement = useCallback((node: HTMLDivElement | null) => {
    const listener = contentContainerEventHandlerRef.current;

    const previousNode = contentContainerRef.current;
    if (previousNode) {
      previousNode.removeEventListener("click", listener, true);
      previousNode.removeEventListener("auxclick", listener, true);
    }

    contentContainerRef.current = node;
    if (node) {
      node.addEventListener("click", listener, true);
      node.addEventListener("auxclick", listener, true);
    }
  }, []);

  useLayoutEffect(() => {
    return () => {
      const contentContainer = contentContainerRef.current;
      if (!contentContainer) {
        return;
      }

      contentContainer.removeEventListener("click", contentContainerEventHandlerRef.current, true);
      contentContainer.removeEventListener("auxclick", contentContainerEventHandlerRef.current, true);
    };
  }, []);

  const handleReaderKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const direction = getReaderScrollDirection(event);
      if (direction === null) {
        return;
      }

      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      event.preventDefault();
      const scrollAmount = Math.max(READER_KEYBOARD_SCROLL_MIN_PX, Math.round(viewport.clientHeight * 0.8));
      viewport.scrollTop += direction * scrollAmount;
      scheduleScrollPositionCommit(article.id, viewport.scrollTop);
    },
    [article.id, scheduleScrollPositionCommit],
  );

  const scrollArea = (
    <ScrollArea
      data-testid="article-reader-scroll-area"
      className="h-full"
      contentClassName="pr-3"
      viewportRef={viewportRef}
      onKeyDown={handleReaderKeyDown}
    >
      <article
        key={article.id}
        data-article-slide-content="true"
        className="w-full px-[clamp(1.75rem,3vw,4rem)] pb-20 pt-10 md:pt-13"
      >
        <ArticleMetaView
          title={article.title}
          author={article.author}
          feedName={feedName}
          siteLink={siteLink}
          publishedLabel={formatArticleDate(article.published_at, resolveArticleDateLocale(i18n.language))}
          onTitleClick={
            articleUrl
              ? (e) => {
                  e.preventDefault();
                  openReaderLink(articleUrl, {
                    external: e.metaKey || e.ctrlKey,
                    onOpenInApp: onOpenArticleTitleInWebPreview,
                  });
                }
              : undefined
          }
          onTitleAuxClick={
            articleUrl
              ? (e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    openReaderLink(articleUrl, { external: true });
                  }
                }
              : undefined
          }
          onFeedClick={
            feedName
              ? () => {
                  selectFeedFromCurrentContext(article.feed_id);
                }
              : undefined
          }
        />

        <div className="mt-4 border-t border-border/20 pt-3">
          <ArticleTagChips articleId={article.id} />
        </div>

        <div className="mt-7" data-article-content-container="true" ref={setContentContainerElement}>
          <ArticleContentView
            thumbnailUrl={article.thumbnail}
            contentHtml={articleContentHtml}
            feedName={feedName}
            confirmPrivateLinks
          />
        </div>
      </article>
    </ScrollArea>
  );

  return (
    <div className="relative h-full min-h-0">
      {scrollArea}
      {hasNextArticle ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
          <IconToolbarSurfaceButton
            label={t("shortcuts.next_article")}
            variant="chrome"
            onClick={() => executeAction("next-article")}
          >
            <ChevronDownIcon className="[filter:drop-shadow(0_1px_2px_rgb(0_0_0/0.45))_drop-shadow(0_0_2px_rgb(255_255_255/0.35))]" />
          </IconToolbarSurfaceButton>
        </div>
      ) : null}
    </div>
  );
}
