import { Result } from "@praha/byethrow";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import { addToReadingList, copyToClipboard, openInBrowser } from "@/api/tauri-commands";
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
import {
  findSelectedArticle,
  formatArticleDate,
  resolveSelectedFeedDisplayMode,
  shouldOpenExternalBrowser,
} from "@/lib/article-view";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { ArticleContentView } from "./article-content-view";
import { ArticleEmptyStateView } from "./article-empty-state-view";
import { ArticleMetaView } from "./article-meta-view";
import { type ArticleTagPickerTagView, ArticleTagPickerView } from "./article-tag-picker-view";
import { ArticleToolbarView } from "./article-toolbar-view";
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
    <ArticleToolbarView
      showSidebarButton={showSidebarButton}
      canToggleRead={article !== null}
      canToggleStar={article !== null}
      isRead={article?.is_read ?? false}
      isStarred={article?.is_starred ?? false}
      showCopyLinkButton={actionCopyLink === "true"}
      canCopyLink={Boolean(article?.url)}
      showOpenInBrowserButton={actionOpenBrowser === "true"}
      canOpenInBrowser={Boolean(article?.url)}
      showOpenInExternalBrowserButton={actionShare === "true"}
      canOpenInExternalBrowser={Boolean(article?.url)}
      labels={{
        showSidebar: t("show_sidebar"),
        toggleRead: t("toggle_read"),
        toggleStar: t("toggle_star"),
        copyLink: t("copy_link"),
        viewInBrowser: t("view_in_browser"),
        openInExternalBrowser: t("open_in_external_browser"),
      }}
      onShowSidebar={() => setFocusedPane("sidebar")}
      onToggleRead={(pressed) => {
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
      onToggleStar={(pressed) => {
        if (!article) return;
        toggleStar.mutate(
          { id: article.id, starred: pressed },
          { onSuccess: () => showToast(pressed ? t("article_starred") : t("article_unstarred")) },
        );
      }}
      onCopyLink={() => {
        if (article?.url) {
          navigator.clipboard.writeText(article.url);
          showToast(t("link_copied"));
        }
      }}
      onOpenInBrowser={() => {
        if (article?.url) {
          openBrowser(article.url);
        }
      }}
      onOpenInExternalBrowser={async () => {
        if (article?.url) {
          const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
          Result.pipe(
            await openInBrowser(article.url, bg),
            Result.inspectError((e) => console.error("Failed to open in browser:", e)),
          );
        }
      }}
    />
  );
}

function EmptyState() {
  const { t } = useTranslation("reader");
  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar article={null} />
      <ArticleEmptyStateView message={t("select_article_to_read")} />
    </div>
  );
}

function toArticleTagPickerTagView(tag: { id: string; name: string; color: string | null }): ArticleTagPickerTagView {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
  };
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

  const assignedTagIds = new Set(articleTags?.map((tag) => tag.id) ?? []);
  const assignedTags = (articleTags ?? []).map(toArticleTagPickerTagView);
  const unassignedTags = (allTags ?? []).filter((tag) => !assignedTagIds.has(tag.id)).map(toArticleTagPickerTagView);

  const handleCreateAndAssign = (name: string) => {
    if (!name) return;
    createTagMutation.mutate(
      { name },
      {
        onSuccess: (tag) => {
          tagArticleMutation.mutate({ articleId, tagId: tag.id });
          setNewTagName("");
          setShowPicker(false);
        },
      },
    );
  };

  return (
    <ArticleTagPickerView
      assignedTags={assignedTags}
      availableTags={unassignedTags}
      newTagName={newTagName}
      isExpanded={showPicker}
      labels={{
        addTag: t("add_tag"),
        availableTags: t("available_tags"),
        newTagPlaceholder: t("new_tag_placeholder"),
        createTag: t("add_tag"),
        removeTag: (name) => t("remove_tag", { name }),
      }}
      onExpandedChange={setShowPicker}
      onNewTagNameChange={setNewTagName}
      onAssignTag={(tagId) => {
        tagArticleMutation.mutate({ articleId, tagId });
      }}
      onRemoveTag={(tagId) => {
        untagArticleMutation.mutate({ articleId, tagId });
      }}
      onCreateTag={handleCreateAndAssign}
    />
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
  const articleUrl = article.url;

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
          <ArticleMetaView
            title={article.title}
            author={article.author}
            feedName={feedName}
            publishedLabel={formatArticleDate(article.published_at)}
            onTitleClick={
              articleUrl
                ? () => {
                    openBrowserView(articleUrl);
                  }
                : undefined
            }
            onTitleAuxClick={
              articleUrl
                ? (e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
                      void openInBrowser(articleUrl, bg);
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

          {/* Tags */}
          <div className="mb-8">
            <ArticleTagChips articleId={article.id} />
          </div>

          {/* Content */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: click handler intercepts anchor navigation in sanitized HTML */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: click handler intercepts anchor navigation in sanitized HTML */}
          <div onClick={handleContentClick}>
            <ArticleContentView thumbnailUrl={article.thumbnail} contentHtml={article.content_sanitized} />
          </div>
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
  const openBrowser = useUiStore((s) => s.openBrowser);
  const readerViewPref = usePreferencesStore((s) => s.prefs.reader_view ?? "off");
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const { data: articles } = useArticles(feedId);
  const { data: accountArticles } = useAccountArticles(selectedAccountId);
  const { data: tagArticles } = useArticlesByTag(tagId);
  const { data: feeds } = useFeeds(selectedAccountId);

  const selectedFeedDisplayMode = resolveSelectedFeedDisplayMode({
    selectedArticleId,
    selectionFeedId: feedId,
    feedId,
    tagId,
    articles,
    accountArticles,
    tagArticles,
    feeds,
  });

  // When reader_view is "on" or feed is widescreen, auto-open article URL in browser view
  const prevArticleIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedArticleId) {
      prevArticleIdRef.current = null;
      return;
    }

    const shouldAutoOpen = readerViewPref === "on" || selectedFeedDisplayMode === "widescreen";
    if (!shouldAutoOpen || selectedArticleId === prevArticleIdRef.current || contentMode !== "reader") {
      return;
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
      return;
    }

    const article = Result.unwrap(articleResult);
    prevArticleIdRef.current = selectedArticleId;
    if (article.url) {
      openBrowser(article.url);
    }
  }, [
    selectedArticleId,
    readerViewPref,
    selectedFeedDisplayMode,
    contentMode,
    feedId,
    tagId,
    articles,
    accountArticles,
    tagArticles,
    openBrowser,
  ]);

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
