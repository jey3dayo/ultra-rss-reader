import { type KeyboardEvent, useCallback, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatArticleDate,
  resolveArticleDateLocale,
  shouldOpenArticleTitleInExternalBrowser,
} from "@/lib/articles/article-view";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { openArticleInExternalBrowser } from "./article-browser-actions";
import { ArticleContentView, fromSanitizedArticleHtml } from "./article-content-view";
import { ArticleMetaView } from "./article-meta-view";
import { ArticleTagChips } from "./article-tag-chips";

type ArticleReaderBodyProps = {
  article: ArticleDto;
  feedName?: string;
  onOpenArticleTitleInWebPreview?: () => void;
};

function resolveArticleContentLinkUrl(href: string, articleUrl: string | null | undefined): string | null {
  const trimmedHref = href.trim();
  if (!trimmedHref) {
    return null;
  }

  try {
    return new URL(trimmedHref).toString();
  } catch {
    if (!articleUrl?.trim()) {
      return null;
    }
  }

  try {
    return new URL(trimmedHref, articleUrl).toString();
  } catch {
    return null;
  }
}

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

export function ArticleReaderBody({ article, feedName, onOpenArticleTitleInWebPreview }: ArticleReaderBodyProps) {
  const { i18n } = useTranslation();
  const openLinks = usePreferencesStore((s) => s.prefs.open_links ?? "in_app");
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
  const articleUrl = article.url;
  const articleContentHtml = fromSanitizedArticleHtml(article.content_sanitized);

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

    setArticleReaderScrollPosition(previousArticleId, viewport.scrollTop);
    viewport.scrollTop = useUiStore.getState().articleReaderScrollPositions.get(article.id) ?? 0;
  }, [article.id, setArticleReaderScrollPosition]);

  useLayoutEffect(() => {
    currentArticleIdRef.current = article.id;
  }, [article.id]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    const handleScroll = () => {
      setArticleReaderScrollPosition(currentArticleIdRef.current, viewport.scrollTop);
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      viewport.removeEventListener("scroll", handleScroll);
      setArticleReaderScrollPosition(currentArticleIdRef.current, viewport.scrollTop);
    };
  }, [setArticleReaderScrollPosition]);

  const openArticleTitle = useCallback(
    (url: string, metaKey = false, ctrlKey = false) => {
      const useExternalBrowser = shouldOpenArticleTitleInExternalBrowser({
        openLinks,
        metaKey,
        ctrlKey,
      });

      if (useExternalBrowser || !onOpenArticleTitleInWebPreview) {
        void openArticleInExternalBrowser(url);
        return;
      }

      onOpenArticleTitleInWebPreview();
    },
    [onOpenArticleTitleInWebPreview, openLinks],
  );

  contentContainerClickListenerRef.current = (event: globalThis.MouseEvent) => {
    const contentContainer = contentContainerRef.current;
    if (!contentContainer) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
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
    const resolvedUrl = resolveArticleContentLinkUrl(anchor.getAttribute("href") ?? "", articleUrl);
    if (!resolvedUrl) {
      return;
    }

    void openArticleInExternalBrowser(resolvedUrl);
  };

  const setContentContainerElement = useCallback((node: HTMLDivElement | null) => {
    const listener = contentContainerEventHandlerRef.current;

    const previousNode = contentContainerRef.current;
    if (previousNode) {
      previousNode.removeEventListener("click", listener, true);
    }

    contentContainerRef.current = node;
    if (node) {
      node.addEventListener("click", listener, true);
    }
  }, []);

  useLayoutEffect(() => {
    return () => {
      const contentContainer = contentContainerRef.current;
      if (!contentContainer) {
        return;
      }

      contentContainer.removeEventListener("click", contentContainerEventHandlerRef.current, true);
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
      const scrollAmount = Math.max(72, Math.round(viewport.clientHeight * 0.8));
      viewport.scrollTop += direction * scrollAmount;
      setArticleReaderScrollPosition(article.id, viewport.scrollTop);
    },
    [article.id, setArticleReaderScrollPosition],
  );

  return (
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
        className="w-full px-[clamp(1.75rem,4vw,4.5rem)] pb-20 pt-10 md:pt-13"
      >
        <ArticleMetaView
          title={article.title}
          author={article.author}
          feedName={feedName}
          publishedLabel={formatArticleDate(article.published_at, resolveArticleDateLocale(i18n.language))}
          onTitleClick={
            articleUrl
              ? (e) => {
                  openArticleTitle(articleUrl, e.metaKey, e.ctrlKey);
                }
              : undefined
          }
          onTitleAuxClick={
            articleUrl
              ? (e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    void openArticleInExternalBrowser(articleUrl);
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
          <ArticleContentView thumbnailUrl={article.thumbnail} contentHtml={articleContentHtml} feedName={feedName} />
        </div>
      </article>
    </ScrollArea>
  );
}
