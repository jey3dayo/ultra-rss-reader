import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatArticleDate, resolveArticleDateLocale, shouldOpenExternalBrowser } from "@/lib/article-view";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { openArticleInExternalBrowser } from "./article-browser-actions";
import { ArticleContentView } from "./article-content-view";
import { ArticleMetaView } from "./article-meta-view";
import { ArticleTagChips } from "./article-tag-chips";

export function ArticleReaderBody({ article, feedName }: { article: ArticleDto; feedName?: string }) {
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
      <article className="mx-auto max-w-3xl px-8 pb-8 pt-10 md:pt-12">
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

        <div className="mb-8">
          <ArticleTagChips articleId={article.id} />
        </div>

        <div ref={setContentContainerElement}>
          <ArticleContentView thumbnailUrl={article.thumbnail} contentHtml={articleContentHtml} feedName={feedName} />
        </div>
      </article>
    </ScrollArea>
  );
}
