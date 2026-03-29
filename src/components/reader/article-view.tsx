import { Toggle } from "@base-ui/react/toggle";
import { Result } from "@praha/byethrow";
import { ArrowLeft, Copy, ExternalLink, Globe, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import { addToReadingList, copyToClipboard, openInBrowser } from "@/api/tauri-commands";
import { StarIcon, UnreadIcon } from "@/components/shared/article-state-icon";
import { Button, buttonVariants } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAccountArticles, useArticles, useSetRead, useToggleStar } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import {
  useArticlesByTag,
  useArticleTags,
  useCreateTag,
  useTagArticle,
  useTags,
  useUntagArticle,
} from "@/hooks/use-tags";
import { findSelectedArticle, formatArticleDate, shouldOpenExternalBrowser } from "@/lib/article-view";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { BrowserView } from "./browser-view";

function ArticleToolbar({ article }: { article: ArticleDto | null }) {
  const { t } = useTranslation("reader");
  const setRead = useSetRead();
  const toggleStar = useToggleStar();
  const openBrowser = useUiStore((s) => s.openBrowser);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const setFocusedPane = useUiStore((s) => s.setFocusedPane);
  const showToast = useUiStore((s) => s.showToast);
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);
  const actionCopyLink = usePreferencesStore((s) => s.prefs.action_copy_link ?? "true");
  const actionOpenBrowser = usePreferencesStore((s) => s.prefs.action_open_browser ?? "true");
  const actionShare = usePreferencesStore((s) => s.prefs.action_share ?? "false");
  const showSidebarButton = layoutMode !== "wide";

  return (
    <div data-tauri-drag-region className="flex h-12 items-center justify-between border-b border-border px-4">
      <div>
        {showSidebarButton && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFocusedPane("sidebar")}
            className="text-muted-foreground"
            aria-label={t("show_sidebar")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Toggle
          pressed={article?.is_read ?? false}
          onPressedChange={(pressed) => {
            if (!article) return;
            setRead.mutate(
              { id: article.id, read: pressed },
              {
                onSuccess: () => {
                  if (pressed) addRecentlyRead(article.id);
                },
              },
            );
          }}
          disabled={!article}
          aria-label={t("toggle_read")}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-muted-foreground")}
        >
          <UnreadIcon unread={!article?.is_read} className="h-3 w-3" />
        </Toggle>
        <Toggle
          pressed={article?.is_starred ?? false}
          onPressedChange={(pressed) => {
            if (!article) return;
            toggleStar.mutate(
              { id: article.id, starred: pressed },
              { onSuccess: () => showToast(pressed ? t("article_starred") : t("article_unstarred")) },
            );
          }}
          disabled={!article}
          aria-label={t("toggle_star")}
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "text-muted-foreground")}
        >
          <StarIcon starred={article?.is_starred ?? false} className="h-4 w-4" />
        </Toggle>
        {actionCopyLink === "true" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (article?.url) {
                navigator.clipboard.writeText(article.url);
                showToast(t("link_copied"));
              }
            }}
            className="text-muted-foreground"
            disabled={!article?.url}
            aria-label={t("copy_link")}
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
        {actionOpenBrowser === "true" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => article?.url && openBrowser(article.url)}
            className="text-muted-foreground"
            disabled={!article?.url}
            aria-label={t("view_in_browser")}
          >
            <Globe className="h-4 w-4" />
          </Button>
        )}
        {actionShare === "true" && (
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              if (article?.url) {
                const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
                Result.pipe(
                  await openInBrowser(article.url, bg),
                  Result.inspectError((e) => console.error("Failed to open in browser:", e)),
                );
              }
            }}
            className="text-muted-foreground"
            disabled={!article?.url}
            aria-label={t("open_in_external_browser")}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation("reader");
  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar article={null} />
      <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
        <p className="text-sm">{t("select_article_to_read")}</p>
      </div>
    </div>
  );
}

function ArticleTagChips({ articleId }: { articleId: string }) {
  const { t } = useTranslation("reader");
  const { data: articleTags } = useArticleTags(articleId);
  const { data: allTags } = useTags();
  const tagArticleMutation = useTagArticle();
  const untagArticleMutation = useUntagArticle();
  const createTagMutation = useCreateTag();
  const [showPicker, setShowPicker] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPicker]);

  const assignedTagIds = new Set(articleTags?.map((tag) => tag.id) ?? []);
  const unassignedTags = (allTags ?? []).filter((tag) => !assignedTagIds.has(tag.id));

  const handleCreateAndAssign = () => {
    const name = newTagName.trim();
    if (!name) return;
    createTagMutation.mutate(
      { name },
      {
        onSuccess: (tag) => {
          tagArticleMutation.mutate({ articleId, tagId: tag.id });
          setNewTagName("");
        },
      },
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {articleTags?.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
        >
          {tag.color && (
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
          )}
          {tag.name}
          <button
            type="button"
            onClick={() => untagArticleMutation.mutate({ articleId, tagId: tag.id })}
            className="ml-0.5 text-muted-foreground hover:text-foreground"
            aria-label={t("remove_tag", { name: tag.name })}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <div ref={pickerRef} className="relative">
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted-foreground text-muted-foreground hover:border-foreground hover:text-foreground"
          aria-label={t("add_tag")}
        >
          <Plus className="h-3 w-3" />
        </button>
        {showPicker && (
          <div className="absolute top-full left-0 z-50 mt-1 min-w-[180px] rounded-lg border border-border bg-popover p-1 shadow-lg">
            {unassignedTags.map((tag) => (
              <button
                type="button"
                key={tag.id}
                onClick={() => {
                  tagArticleMutation.mutate({ articleId, tagId: tag.id });
                  setShowPicker(false);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm text-popover-foreground hover:bg-accent"
              >
                {tag.color && (
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                )}
                {tag.name}
              </button>
            ))}
            <div className="flex items-center gap-1 border-t border-border px-2 pt-1">
              <input
                name="new-tag"
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateAndAssign();
                }}
                placeholder={t("new_tag_placeholder")}
                className="flex-1 rounded border-none bg-transparent px-1 py-1 text-xs outline-none placeholder:text-muted-foreground"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleCreateAndAssign}
                disabled={!newTagName.trim()}
                className="h-5 w-5 text-muted-foreground"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ArticleReader({ article, feedName }: { article: ArticleDto; feedName?: string }) {
  const afterReading = usePreferencesStore((s) => s.prefs.after_reading ?? "mark_as_read");
  const openLinks = usePreferencesStore((s) => s.prefs.open_links ?? "in_app");
  const cmdClickBrowser = usePreferencesStore((s) => s.prefs.cmd_click_browser ?? "false");
  const setRead = useSetRead();
  const toggleStar = useToggleStar();
  const openBrowserView = useUiStore((s) => s.openBrowser);
  const selectFeed = useUiStore((s) => s.selectFeed);
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);

  // Auto mark as read only when a new article is opened (article.id changes).
  // Must NOT depend on article.is_read — otherwise manually marking unread
  // re-triggers this effect and immediately marks it read again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally trigger only on article.id change
  useEffect(() => {
    if (afterReading === "mark_as_read" && article && !article.is_read) {
      setRead.mutate({ id: article.id, read: true }, { onSuccess: () => addRecentlyRead(article.id) });
    }
  }, [afterReading, article?.id]);

  useEffect(() => {
    const handleToggleRead = () => {
      const markingAsRead = !article.is_read;
      setRead.mutate(
        { id: article.id, read: markingAsRead },
        {
          onSuccess: () => {
            if (markingAsRead) addRecentlyRead(article.id);
          },
        },
      );
    };
    const handleToggleStar = () => {
      toggleStar.mutate({ id: article.id, starred: !article.is_starred });
    };
    const handleOpenInAppBrowser = () => {
      if (article.url) {
        openBrowserView(article.url);
      }
    };
    const handleOpenExternalBrowser = () => {
      if (!article.url) return;
      const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
      openInBrowser(article.url, bg).then((result) =>
        Result.pipe(
          result,
          Result.inspectError((e) => console.error("Failed to open in browser:", e)),
        ),
      );
    };
    const handleCopyLink = () => {
      if (!article.url) return;
      const showToast = useUiStore.getState().showToast;
      void copyToClipboard(article.url).then((result) =>
        Result.pipe(
          result,
          Result.inspect(() => showToast("Link copied")),
          Result.inspectError((e) => {
            console.error("Copy failed:", e);
            showToast(e.message);
          }),
        ),
      );
    };
    const handleAddToReadingList = () => {
      if (!article.url) return;
      const showToast = useUiStore.getState().showToast;
      void addToReadingList(article.url).then((result) =>
        Result.pipe(
          result,
          Result.inspect(() => showToast("Added to Reading List")),
          Result.inspectError((e) => {
            console.error("Add to reading list failed:", e);
            showToast(e.message);
          }),
        ),
      );
    };

    window.addEventListener(keyboardEvents.toggleRead, handleToggleRead);
    window.addEventListener(keyboardEvents.toggleStar, handleToggleStar);
    window.addEventListener(keyboardEvents.openInAppBrowser, handleOpenInAppBrowser);
    window.addEventListener(keyboardEvents.openExternalBrowser, handleOpenExternalBrowser);
    window.addEventListener(keyboardEvents.copyLink, handleCopyLink);
    window.addEventListener(keyboardEvents.addToReadingList, handleAddToReadingList);
    return () => {
      window.removeEventListener(keyboardEvents.toggleRead, handleToggleRead);
      window.removeEventListener(keyboardEvents.toggleStar, handleToggleStar);
      window.removeEventListener(keyboardEvents.openInAppBrowser, handleOpenInAppBrowser);
      window.removeEventListener(keyboardEvents.openExternalBrowser, handleOpenExternalBrowser);
      window.removeEventListener(keyboardEvents.copyLink, handleCopyLink);
      window.removeEventListener(keyboardEvents.addToReadingList, handleAddToReadingList);
    };
  }, [
    article.id,
    article.is_read,
    article.is_starred,
    article.url,
    openBrowserView,
    setRead,
    toggleStar,
    addRecentlyRead,
  ]);

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor?.href) return;
    e.preventDefault();

    const useExternal = shouldOpenExternalBrowser({
      openLinks,
      cmdClickBrowser,
      metaKey: e.metaKey,
      ctrlKey: e.ctrlKey,
    });
    if (useExternal) {
      const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
      openInBrowser(anchor.href, bg);
    } else {
      openBrowserView(anchor.href);
    }
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar article={article} />
      <ScrollArea className="flex-1">
        <article className="mx-auto max-w-3xl px-8 py-8">
          {/* Title block — date, title, author & feed as a clickable group */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled via onKeyDown */}
          <div
            className={cn(
              "-mx-4 mb-4 rounded-lg px-4 py-3 transition-colors",
              article.url && "cursor-pointer hover:bg-muted/50",
            )}
            onClick={() => article.url && openBrowserView(article.url)}
            onAuxClick={(e) => {
              if (e.button === 1 && article.url) {
                e.preventDefault();
                const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
                openInBrowser(article.url, bg);
              }
            }}
            onKeyDown={(e) => {
              if (article.url && (e.key === "Enter" || e.key === " ")) openBrowserView(article.url);
            }}
          >
            <p className="mb-2 text-xs tracking-wider text-muted-foreground">
              {formatArticleDate(article.published_at)}
            </p>
            <h1 className="mb-2 text-2xl font-bold leading-tight text-foreground">{article.title}</h1>
            {(article.author || feedName) && (
              <div className="text-sm text-muted-foreground">
                {article.author && <p className="uppercase tracking-wide">{article.author}</p>}
                {feedName && (
                  <button
                    type="button"
                    className="cursor-pointer text-xs hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectFeed(article.feed_id);
                    }}
                  >
                    {feedName}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="mb-8">
            <ArticleTagChips articleId={article.id} />
          </div>

          {/* Featured Image */}
          {article.thumbnail && (
            <div className="relative mb-8 aspect-video w-full overflow-hidden rounded-lg">
              <img src={article.thumbnail} alt="" className="h-full w-full object-cover" />
            </div>
          )}

          {/* Content */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: click handler intercepts anchor navigation in sanitized HTML */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: click handler intercepts anchor navigation in sanitized HTML */}
          <div
            className="prose prose-invert max-w-none text-base leading-relaxed text-foreground/90"
            onClick={handleContentClick}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is pre-sanitized by Rust backend
            dangerouslySetInnerHTML={{ __html: article.content_sanitized }}
          />
        </article>
      </ScrollArea>
    </div>
  );
}

export function ArticleView() {
  const contentMode = useUiStore((s) => s.contentMode);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const selection = useUiStore((s) => s.selection);
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const { data: articles } = useArticles(feedId);
  const { data: accountArticles } = useAccountArticles(selectedAccountId);
  const { data: tagArticles } = useArticlesByTag(tagId);
  const { data: feeds } = useFeeds(selectedAccountId);

  if (contentMode === "browser") {
    return <BrowserView />;
  }

  if (contentMode === "empty" || !selectedArticleId) {
    return <EmptyState />;
  }

  const articleResult = findSelectedArticle({
    selectedArticleId,
    feedId,
    tagId,
    articles,
    accountArticles,
    tagArticles,
  });

  if (Result.isFailure(articleResult)) {
    return (
      <div className="flex h-full flex-1 flex-col items-center justify-center bg-background text-muted-foreground">
        Article not found
      </div>
    );
  }

  const article = Result.unwrap(articleResult);

  const feedName = feeds?.find((f) => f.id === article.feed_id)?.title;

  return <ArticleReader article={article} feedName={feedName} />;
}
