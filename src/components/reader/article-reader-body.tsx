import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatArticleDate, resolveArticleDateLocale, shouldOpenExternalBrowser } from "@/lib/article-view";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { openArticleInExternalBrowser } from "./article-browser-actions";
import { ArticleContentView } from "./article-content-view";
import { ArticleMetaView } from "./article-meta-view";
import { ArticleTagChips } from "./article-tag-chips";
import type { ArticleReaderBodyProps } from "./article-view.types";

export function ArticleReaderBody({ article, feedName }: ArticleReaderBodyProps) {
  const { i18n } = useTranslation();
  const openLinks = usePreferencesStore((s) => s.prefs.open_links ?? "in_app");
  const cmdClickBrowser = usePreferencesStore((s) => s.prefs.cmd_click_browser ?? "false");
  const selectFeed = useUiStore((s) => s.selectFeed);
  const articleUrl = article.url;
  const [contentContainerElement, setContentContainerElement] = useState<HTMLDivElement | null>(null);
  const articleContentHtml = article.content_sanitized;

  const openArticleUrl = useCallback(
    (url: string, metaKey = false, ctrlKey = false) => {
      const useExternal = shouldOpenExternalBrowser({
        openLinks,
        cmdClickBrowser,
        metaKey,
        ctrlKey,
      });

      if (useExternal) {
        void openArticleInExternalBrowser(url);
        return;
      }

      void openArticleInExternalBrowser(url);
    },
    [cmdClickBrowser, openLinks],
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
      const pointerEvent = event as MouseEvent;
      openArticleUrl(anchor.href, pointerEvent.metaKey, pointerEvent.ctrlKey);
    };

    for (const anchor of anchors) {
      anchor.addEventListener("click", handleContentClick);
    }

    return () => {
      for (const anchor of anchors) {
        anchor.removeEventListener("click", handleContentClick);
      }
    };
  }, [articleContentHtml, contentContainerElement, openArticleUrl]);

  return (
    <ScrollArea data-testid="article-reader-scroll-area" className="h-full">
      <article className="mx-auto max-w-[44rem] px-7 pb-20 pt-12 md:px-11 md:pt-16">
        <ArticleMetaView
          title={article.title}
          author={article.author}
          feedName={feedName}
          publishedLabel={formatArticleDate(article.published_at, resolveArticleDateLocale(i18n.language))}
          onTitleClick={
            articleUrl
              ? (e) => {
                  openArticleUrl(articleUrl, e.metaKey, e.ctrlKey);
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

        <div className="mt-6 border-t border-border/28 pt-3.5">
          <ArticleTagChips articleId={article.id} />
        </div>

        <div className="mt-8" ref={setContentContainerElement}>
          <ArticleContentView thumbnailUrl={article.thumbnail} contentHtml={articleContentHtml} feedName={feedName} />
        </div>
      </article>
    </ScrollArea>
  );
}
