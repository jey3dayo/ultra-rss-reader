import { type KeyboardEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { ArticleContentView } from "./article-content-view";
import { ArticleMetaView } from "./article-meta-view";
import { ArticleTagChips } from "./article-tag-chips";

type ArticleReaderBodyProps = {
  article: ArticleDto;
  feedName?: string;
  onOpenArticleTitleInWebPreview?: () => void;
};

function getArticleContentAnchors(contentContainer: HTMLElement): HTMLAnchorElement[] {
  return Array.from(contentContainer.querySelectorAll<HTMLAnchorElement>("a[href]"));
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
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const previousArticleIdRef = useRef(article.id);
  const articleUrl = article.url;
  const [contentContainerElement, setContentContainerElement] = useState<HTMLDivElement | null>(null);
  const articleContentHtml = article.content_sanitized;

  useLayoutEffect(() => {
    if (previousArticleIdRef.current === article.id) {
      return;
    }

    previousArticleIdRef.current = article.id;
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTop = 0;
  });

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

  useEffect(() => {
    const contentContainer = contentContainerElement;
    if (!contentContainer || !articleContentHtml) {
      return;
    }

    const anchors = getArticleContentAnchors(contentContainer);
    const handleContentClick = (event: Event) => {
      const anchor = event.currentTarget;
      if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) {
        return;
      }
      event.preventDefault();
      void openArticleInExternalBrowser(anchor.href);
    };

    for (const anchor of anchors) {
      anchor.addEventListener("click", handleContentClick);
    }

    return () => {
      for (const anchor of anchors) {
        anchor.removeEventListener("click", handleContentClick);
      }
    };
  }, [articleContentHtml, contentContainerElement]);

  const handleReaderKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
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
  }, []);

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
        className="mx-auto max-w-[44rem] px-7 pb-20 pt-10 md:px-11 md:pt-13"
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

        <div className="mt-7" ref={setContentContainerElement}>
          <ArticleContentView thumbnailUrl={article.thumbnail} contentHtml={articleContentHtml} feedName={feedName} />
        </div>
      </article>
    </ScrollArea>
  );
}
