import { Menu } from "@base-ui/react/menu";
import { Result } from "@praha/byethrow";
import { BookmarkPlus, Copy, Mail, Share } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import { addToReadingList, copyToClipboard, openInBrowser } from "@/api/tauri-commands";
import { IconToolbarMenuTrigger } from "@/components/shared/icon-toolbar-control";
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
  resolveArticleDateLocale,
  resolveEffectiveDisplayMode,
  resolveSelectedFeedDisplayMode,
  shouldOpenExternalBrowser,
} from "@/lib/article-view";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { usePlatformStore } from "@/stores/platform-store";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { ArticleContentView } from "./article-content-view";
import { ArticleEmptyStateView } from "./article-empty-state-view";
import { ArticleMetaView } from "./article-meta-view";
import { type ArticleTagPickerTagView, ArticleTagPickerView } from "./article-tag-picker-view";
import { ArticleToolbarView } from "./article-toolbar-view";
import { BrowserView } from "./browser-view";
import { contextMenuStyles } from "./context-menu-styles";

function ArticleToolbar({ article }: { article: ArticleDto | null }) {
  const { t } = useTranslation("reader");
  const setRead = useSetRead();
  const toggleStar = useToggleStar();
  const contentMode = useUiStore((s) => s.contentMode);
  const openBrowser = useUiStore((s) => s.openBrowser);
  const closeBrowser = useUiStore((s) => s.closeBrowser);
  const clearArticle = useUiStore((s) => s.clearArticle);
  const layoutMode = useUiStore((s) => s.layoutMode);
  const showToast = useUiStore((s) => s.showToast);
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);
  const retainArticle = useUiStore((s) => s.retainArticle);
  const viewMode = useUiStore((s) => s.viewMode);
  const actionCopyLink = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "action_copy_link"));
  const actionOpenBrowser = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "action_open_browser"));
  const actionShare = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "action_share"));
  const actionShareMenu = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "action_share_menu"));
  const supportsReadingList = usePlatformStore((s) => s.platform.capabilities.supports_reading_list);
  const isBrowserOpen = contentMode === "browser";

  const handleCloseView = () => {
    clearArticle();
    if (layoutMode !== "wide") {
      useUiStore.getState().setFocusedPane("list");
    }
  };

  return (
    <ArticleToolbarView
      showCloseButton={article !== null}
      canToggleRead={article !== null}
      canToggleStar={article !== null}
      isRead={article?.is_read ?? false}
      isStarred={article?.is_starred ?? false}
      isBrowserOpen={isBrowserOpen}
      showCopyLinkButton={actionCopyLink === "true"}
      canCopyLink={Boolean(article?.url)}
      showOpenInBrowserButton={actionOpenBrowser === "true"}
      canOpenInBrowser={Boolean(article?.url)}
      showOpenInExternalBrowserButton={actionShare === "true"}
      canOpenInExternalBrowser={Boolean(article?.url)}
      displayModeControl={null}
      shareMenuControl={
        actionShareMenu === "true" ? (
          <Menu.Root>
            <IconToolbarMenuTrigger label={t("share")} disabled={!article?.url}>
              <Share className="h-4 w-4" />
            </IconToolbarMenuTrigger>
            <Menu.Portal>
              <Menu.Positioner sideOffset={4}>
                <Menu.Popup className={contextMenuStyles.popup}>
                  <Menu.Item
                    className={contextMenuStyles.item}
                    onSelect={async () => {
                      if (!article?.url) return;
                      Result.pipe(
                        await copyToClipboard(article.url),
                        Result.inspect(() => showToast(t("link_copied"))),
                        Result.inspectError((e) => {
                          console.error("Copy failed:", e);
                          showToast(e.message);
                        }),
                      );
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    {t("copy_link")}
                  </Menu.Item>
                  {supportsReadingList ? (
                    <Menu.Item
                      className={contextMenuStyles.item}
                      onSelect={async () => {
                        if (!article?.url) return;
                        Result.pipe(
                          await addToReadingList(article.url),
                          Result.inspect(() => showToast(t("added_to_reading_list"))),
                          Result.inspectError((e) => {
                            console.error("Add to reading list failed:", e);
                            showToast(e.message);
                          }),
                        );
                      }}
                    >
                      <BookmarkPlus className="mr-2 h-4 w-4" />
                      {t("add_to_reading_list")}
                    </Menu.Item>
                  ) : null}
                  <Menu.Separator className={contextMenuStyles.separator} />
                  <Menu.Item
                    className={contextMenuStyles.item}
                    onSelect={async () => {
                      if (!article?.url) return;
                      const mailto = `mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(article.url)}`;
                      Result.pipe(
                        await openInBrowser(mailto, false),
                        Result.inspectError((e) => {
                          console.error("Failed to open email client:", e);
                          showToast(e.message);
                        }),
                      );
                    }}
                  >
                    <Mail className="mr-2 h-4 w-4" />
                    {t("share_via_email")}
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ) : null
      }
      labels={{
        closeView: t("close_view"),
        toggleRead: t("toggle_read"),
        toggleStar: t("toggle_star"),
        copyLink: t("copy_link"),
        viewInBrowser: isBrowserOpen ? t("close_browser_window") : t("view_in_browser"),
        openInExternalBrowser: t("open_in_external_browser"),
      }}
      onCloseView={handleCloseView}
      onToggleRead={(pressed) => {
        if (!article) return;
        setRead.mutate(
          { id: article.id, read: pressed },
          {
            onSuccess: () => {
              if (pressed) {
                addRecentlyRead(article.id);
                if (viewMode === "unread") retainArticle(article.id);
              }
            },
          },
        );
      }}
      onToggleStar={(pressed) => {
        if (!article) return;
        toggleStar.mutate(
          { id: article.id, starred: pressed },
          {
            onSuccess: () => {
              if (!pressed && viewMode === "starred") retainArticle(article.id);
              showToast(pressed ? t("article_starred") : t("article_unstarred"));
            },
          },
        );
      }}
      onCopyLink={() => {
        if (article?.url) {
          navigator.clipboard.writeText(article.url);
          showToast(t("link_copied"));
        }
      }}
      onOpenInBrowser={() => {
        if (isBrowserOpen) {
          closeBrowser();
          return;
        }

        if (article?.url) {
          openBrowser(article.url);
        }
      }}
      onOpenInExternalBrowser={async () => {
        if (article?.url) {
          const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
          Result.pipe(
            await openInBrowser(article.url, bg),
            Result.inspectError((e) => {
              console.error("Failed to open in browser:", e);
              showToast(e.message);
            }),
          );
        }
      }}
    />
  );
}

function EmptyState({ browserView }: { browserView?: ReactNode }) {
  const { t } = useTranslation("reader");
  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar article={null} />
      {browserView}
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
        createTag: t("create_tag"),
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

function ArticleReader({
  article,
  feedName,
  browserView,
}: {
  article: ArticleDto;
  feedName?: string;
  browserView?: ReactNode;
}) {
  const { i18n } = useTranslation();
  const afterReading = usePreferencesStore((s) => s.prefs.after_reading ?? "mark_as_read");
  const openLinks = usePreferencesStore((s) => s.prefs.open_links ?? "in_app");
  const cmdClickBrowser = usePreferencesStore((s) => s.prefs.cmd_click_browser ?? "false");
  const setRead = useSetRead();
  const toggleStar = useToggleStar();
  const openBrowserView = useUiStore((s) => s.openBrowser);
  const selectFeed = useUiStore((s) => s.selectFeed);
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);
  const retainArticle = useUiStore((s) => s.retainArticle);
  const viewMode = useUiStore((s) => s.viewMode);
  const supportsReadingList = usePlatformStore((s) => s.platform.capabilities.supports_reading_list);
  const articleUrl = article.url;

  const openArticleUrl = (url: string, metaKey = false, ctrlKey = false) => {
    const useExternal = shouldOpenExternalBrowser({
      openLinks,
      cmdClickBrowser,
      metaKey,
      ctrlKey,
    });

    if (useExternal) {
      const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
      void openInBrowser(url, bg).then((result) =>
        Result.pipe(
          result,
          Result.inspectError((e) => {
            console.error("Failed to open in browser:", e);
            useUiStore.getState().showToast(e.message);
          }),
        ),
      );
      return;
    }

    openBrowserView(url);
  };

  // Auto mark as read only when a new article is opened (article.id changes).
  // Must NOT depend on article.is_read — otherwise manually marking unread
  // re-triggers this effect and immediately marks it read again.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally trigger only on article.id change
  useEffect(() => {
    if (afterReading === "mark_as_read" && article && !article.is_read) {
      setRead.mutate(
        {
          id: article.id,
          read: true,
        },
        {
          onSuccess: () => {
            addRecentlyRead(article.id);
            if (viewMode === "unread") retainArticle(article.id);
          },
        },
      );
    }
  }, [afterReading, article?.id]);

  useEffect(() => {
    const handleToggleRead = () => {
      const markingAsRead = !article.is_read;
      setRead.mutate(
        { id: article.id, read: markingAsRead },
        {
          onSuccess: () => {
            if (markingAsRead) {
              addRecentlyRead(article.id);
              if (viewMode === "unread") retainArticle(article.id);
            }
          },
        },
      );
    };
    const handleToggleStar = () => {
      const nextStarred = !article.is_starred;
      toggleStar.mutate(
        { id: article.id, starred: nextStarred },
        {
          onSuccess: () => {
            if (!nextStarred && viewMode === "starred") retainArticle(article.id);
          },
        },
      );
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
          Result.inspectError((e) => {
            console.error("Failed to open in browser:", e);
            useUiStore.getState().showToast(e.message);
          }),
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
      if (!supportsReadingList || !article.url) return;
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
    retainArticle,
    supportsReadingList,
    viewMode,
  ]);

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor?.href) return;
    e.preventDefault();
    openArticleUrl(anchor.href, e.metaKey, e.ctrlKey);
  };

  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar article={article} />
      {browserView}
      <ScrollArea className="flex-1">
        <article className="mx-auto max-w-3xl px-8 py-8">
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
  const readerViewPref = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "reader_view"));
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const { data: articles } = useArticles(feedId);
  const { data: accountArticles } = useAccountArticles(selectedAccountId);
  const { data: tagArticles } = useArticlesByTag(tagId, selectedAccountId);
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
  const effectiveDisplayMode = resolveEffectiveDisplayMode(selectedFeedDisplayMode, readerViewPref);

  // Auto-open only when the effective mode resolves to widescreen.
  const prevArticleIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedArticleId) {
      prevArticleIdRef.current = null;
      return;
    }

    const shouldAutoOpen = effectiveDisplayMode === "widescreen";
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
    effectiveDisplayMode,
    contentMode,
    feedId,
    tagId,
    articles,
    accountArticles,
    tagArticles,
    openBrowser,
  ]);

  const browserView = contentMode === "browser" ? <BrowserView /> : null;

  if (contentMode === "empty" || !selectedArticleId) {
    return <EmptyState browserView={browserView} />;
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
      <div className="flex h-full flex-1 flex-col bg-background">
        {browserView}
        <div className="flex flex-1 items-center justify-center text-muted-foreground">Article not found</div>
      </div>
    );
  }

  const article = Result.unwrap(articleResult);

  const feedName = feeds?.find((f) => f.id === article.feed_id)?.title;

  return <ArticleReader article={article} feedName={feedName} browserView={browserView} />;
}
