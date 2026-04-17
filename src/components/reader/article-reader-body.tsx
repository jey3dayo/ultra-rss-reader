import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  formatArticleDate,
  resolveArticleDateLocale,
  shouldOpenArticleTitleInExternalBrowser,
} from "@/lib/article-view";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { openArticleInExternalBrowser } from "./article-browser-actions";
import { ArticleContentView } from "./article-content-view";
import { ArticleMetaView } from "./article-meta-view";
import { ArticleTagChips } from "./article-tag-chips";
import type { ArticleReaderBodyProps } from "./article-view.types";

export function ArticleReaderBody({ article, feedName, onOpenArticleTitleInWebPreview }: ArticleReaderBodyProps) {
  const { i18n } = useTranslation();
  const openLinks = usePreferencesStore((s) => s.prefs.open_links ?? "in_app");
  const selectFeed = useUiStore((s) => s.selectFeed);
  const articleUrl = article.url;
  const [contentContainerElement, setContentContainerElement] = useState<HTMLDivElement | null>(null);
  const articleContentHtml = article.content_sanitized;

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

    const anchors = Array.from(contentContainer.querySelectorAll("a[href]")) as HTMLAnchorElement[];
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

  return (
    <ScrollArea data-testid="article-reader-scroll-area" className="h-full">
      <article className="mx-auto max-w-[44rem] px-7 pb-20 pt-10 md:px-11 md:pt-13">
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
                  selectFeed(article.feed_id);
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
