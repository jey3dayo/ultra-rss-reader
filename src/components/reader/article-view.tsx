import { Menu } from "@base-ui/react/menu";
import { Result } from "@praha/byethrow";
import { BookmarkPlus, Copy, Mail, Share } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
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
  type BinaryDisplayMode,
  resolveAppDefaultDisplayModes,
  resolveArticleDisplay,
  resolveFeedDisplayOverrides,
} from "@/lib/article-display";
import {
  findSelectedArticle,
  formatArticleDate,
  resolveArticleDateLocale,
  shouldOpenExternalBrowser,
} from "@/lib/article-view";
import { readDevIntent, resolveActiveDevIntentBrowserUrl } from "@/lib/dev-intent";
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

function openArticleInExternalBrowser(url: string) {
  const bg = (usePreferencesStore.getState().prefs.open_links_background ?? "false") === "true";
  return openInBrowser(url, bg).then((result) =>
    Result.pipe(
      result,
      Result.inspectError((e) => {
        console.error("Failed to open in browser:", e);
        useUiStore.getState().showToast(e.message);
      }),
    ),
  );
}

function ArticleToolbar({
  article,
  isBrowserOpen,
  onCloseView,
  onToggleBrowserOverlay,
}: {
  article: ArticleDto | null;
  isBrowserOpen: boolean;
  onCloseView: () => void;
  onToggleBrowserOverlay: () => void;
}) {
  const { t } = useTranslation("reader");
  const setRead = useSetRead();
  const toggleStar = useToggleStar();
  const showToast = useUiStore((s) => s.showToast);
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);
  const retainArticle = useUiStore((s) => s.retainArticle);
  const viewMode = useUiStore((s) => s.viewMode);
  const actionCopyLink = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "action_copy_link"));
  const actionShare = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "action_share"));
  const actionShareMenu = usePreferencesStore((s) => resolvePreferenceValue(s.prefs, "action_share_menu"));
  const supportsReadingList = usePlatformStore((s) => s.platform.capabilities.supports_reading_list);

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
      showOpenInBrowserButton
      canOpenInBrowser={Boolean(article?.url)}
      showOpenInExternalBrowserButton={actionShare === "true"}
      canOpenInExternalBrowser={Boolean(article?.url)}
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
        previewToggleOff: t("open_in_browser"),
        previewToggleOn: t("close_browser_overlay"),
        copyLink: t("copy_link"),
        openInExternalBrowser: t("open_in_external_browser"),
      }}
      onCloseView={onCloseView}
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
      onOpenInBrowser={onToggleBrowserOverlay}
      onOpenInExternalBrowser={async () => {
        if (article?.url) {
          await openArticleInExternalBrowser(article.url);
        }
      }}
    />
  );
}

function EmptyState() {
  const { t } = useTranslation("reader");
  return (
    <div className="flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar
        article={null}
        isBrowserOpen={false}
        onCloseView={() => {}}
        onToggleBrowserOverlay={() => {}}
      />
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

function ArticleReaderBody({ article, feedName }: { article: ArticleDto; feedName?: string }) {
  const { i18n } = useTranslation();
  const openLinks = usePreferencesStore((s) => s.prefs.open_links ?? "in_app");
  const cmdClickBrowser = usePreferencesStore((s) => s.prefs.cmd_click_browser ?? "false");
  const selectFeed = useUiStore((s) => s.selectFeed);
  const articleUrl = article.url;

  const openArticleUrl = (url: string, metaKey = false, ctrlKey = false) => {
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
  };

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest("a");
    if (!anchor?.href) return;
    e.preventDefault();
    openArticleUrl(anchor.href, e.metaKey, e.ctrlKey);
  };

  return (
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

        <div className="mb-8">
          <ArticleTagChips articleId={article.id} />
        </div>

        {/* biome-ignore lint/a11y/useKeyWithClickEvents: click handler intercepts anchor navigation in sanitized HTML */}
        {/* biome-ignore lint/a11y/noStaticElementInteractions: click handler intercepts anchor navigation in sanitized HTML */}
        <div onClick={handleContentClick}>
          <ArticleContentView thumbnailUrl={article.thumbnail} contentHtml={article.content_sanitized} />
        </div>
      </article>
    </ScrollArea>
  );
}

function ArticlePane({ article, feed, feedName }: { article: ArticleDto; feed?: FeedDto; feedName?: string }) {
  const { t } = useTranslation("reader");
  const layoutMode = useUiStore((s) => s.layoutMode);
  const contentMode = useUiStore((s) => s.contentMode);
  const browserUrl = useUiStore((s) => s.browserUrl);
  const openBrowser = useUiStore((s) => s.openBrowser);
  const closeBrowser = useUiStore((s) => s.closeBrowser);
  const clearArticle = useUiStore((s) => s.clearArticle);
  const showToast = useUiStore((s) => s.showToast);
  const addRecentlyRead = useUiStore((s) => s.addRecentlyRead);
  const retainArticle = useUiStore((s) => s.retainArticle);
  const viewMode = useUiStore((s) => s.viewMode);
  const supportsReadingList = usePlatformStore((s) => s.platform.capabilities.supports_reading_list);
  const afterReading = usePreferencesStore((s) => s.prefs.after_reading ?? "mark_as_read");
  const prefs = usePreferencesStore((s) => s.prefs);
  const setRead = useSetRead();
  const toggleStar = useToggleStar();
  const [readerModeOverride, setReaderModeOverride] = useState<BinaryDisplayMode | null>(null);
  const [webPreviewModeOverride, setWebPreviewModeOverride] = useState<BinaryDisplayMode | null>(null);
  const overlayFocusReturnTargetRef = useRef<HTMLElement | null>(null);
  const overlayFocusReturnTargetKeyRef = useRef<string | null>(null);
  const previousArticleIdRef = useRef(article.id);
  const wasBrowserOpenRef = useRef(false);
  const isBrowserOpen = contentMode === "browser";
  const devIntent = readDevIntent();
  const intendedBrowserUrl = resolveActiveDevIntentBrowserUrl(devIntent, browserUrl, article.url);
  const requestedDisplay = resolveArticleDisplay({
    appDefault: resolveAppDefaultDisplayModes(prefs),
    feedOverride: resolveFeedDisplayOverrides(feed),
    temporaryOverride: { readerMode: readerModeOverride, webPreviewMode: webPreviewModeOverride },
    articleCapabilities: { hasWebPreview: true },
  });
  const resolvedDisplay = resolveArticleDisplay({
    appDefault: resolveAppDefaultDisplayModes(prefs),
    feedOverride: resolveFeedDisplayOverrides(feed),
    temporaryOverride: { readerMode: readerModeOverride, webPreviewMode: webPreviewModeOverride },
    articleCapabilities: { hasWebPreview: Boolean(intendedBrowserUrl) },
  });
  const shouldShowBrowserOverlay = Boolean(intendedBrowserUrl) && resolvedDisplay.webPreviewMode;

  useEffect(() => {
    previousArticleIdRef.current = article.id;
    setReaderModeOverride(null);
    setWebPreviewModeOverride(null);
  }, [article.id]);

  const rememberOverlayFocusReturnTarget = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement) || activeElement === document.body) {
      return;
    }

    overlayFocusReturnTargetRef.current = activeElement;
    overlayFocusReturnTargetKeyRef.current = activeElement.getAttribute("data-browser-overlay-return-focus");
  }, []);

  useEffect(() => {
    if (afterReading === "mark_as_read" && !article.is_read) {
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
  }, [addRecentlyRead, afterReading, article.id, article.is_read, retainArticle, setRead, viewMode]);

  useEffect(() => {
    if (!intendedBrowserUrl) {
      if (isBrowserOpen) {
        closeBrowser();
      }
      return;
    }

    if (shouldShowBrowserOverlay) {
      if (!isBrowserOpen || browserUrl !== intendedBrowserUrl) {
        if (!isBrowserOpen) {
          rememberOverlayFocusReturnTarget();
        }
        openBrowser(intendedBrowserUrl);
      }
      return;
    }

    if (isBrowserOpen) {
      closeBrowser();
    }
  }, [
    browserUrl,
    closeBrowser,
    intendedBrowserUrl,
    isBrowserOpen,
    openBrowser,
    rememberOverlayFocusReturnTarget,
    shouldShowBrowserOverlay,
  ]);

  useEffect(() => {
    if (wasBrowserOpenRef.current && !isBrowserOpen && typeof document !== "undefined") {
      const previousTarget = overlayFocusReturnTargetRef.current;
      const previousTargetKey = overlayFocusReturnTargetKeyRef.current;
      overlayFocusReturnTargetRef.current = null;
      overlayFocusReturnTargetKeyRef.current = null;

      requestAnimationFrame(() => {
        if (previousTargetKey) {
          const nextTarget = document.querySelector<HTMLElement>(
            `[data-browser-overlay-return-focus="${previousTargetKey}"]`,
          );
          if (nextTarget && !nextTarget.hasAttribute("disabled")) {
            nextTarget.focus();
            return;
          }
        }

        if (previousTarget?.isConnected && !previousTarget.hasAttribute("disabled")) {
          previousTarget.focus();
          return;
        }

        document.querySelector<HTMLElement>('[data-browser-overlay-return-focus="open-in-browser"]')?.focus();
      });
    }

    wasBrowserOpenRef.current = isBrowserOpen;
  }, [isBrowserOpen]);

  const handleCloseView = useCallback(() => {
    clearArticle();
    if (layoutMode !== "wide") {
      useUiStore.getState().setFocusedPane("list");
    }
  }, [clearArticle, layoutMode]);

  const handleToggleBrowserOverlay = useCallback(() => {
    rememberOverlayFocusReturnTarget();

    if (requestedDisplay.webPreviewMode) {
      setReaderModeOverride(requestedDisplay.readerMode ? "on" : "off");
      setWebPreviewModeOverride("off");
      closeBrowser();
      return;
    }

    setReaderModeOverride(requestedDisplay.readerMode ? "on" : "off");
    setWebPreviewModeOverride("on");
  }, [closeBrowser, rememberOverlayFocusReturnTarget, requestedDisplay.readerMode, requestedDisplay.webPreviewMode]);

  const handleToggleRead = useCallback(() => {
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
  }, [addRecentlyRead, article.id, article.is_read, retainArticle, setRead, viewMode]);

  const handleToggleStar = useCallback(() => {
    const nextStarred = !article.is_starred;
    toggleStar.mutate(
      { id: article.id, starred: nextStarred },
      {
        onSuccess: () => {
          if (!nextStarred && viewMode === "starred") retainArticle(article.id);
        },
      },
    );
  }, [article.id, article.is_starred, retainArticle, toggleStar, viewMode]);

  const handleOpenExternalBrowser = useCallback(() => {
    if (!article.url) return;
    void openArticleInExternalBrowser(article.url);
  }, [article.url]);

  const handleCopyLink = useCallback(() => {
    if (!article.url) return;
    void copyToClipboard(article.url).then((result) =>
      Result.pipe(
        result,
        Result.inspect(() => showToast(t("link_copied"))),
        Result.inspectError((e) => {
          console.error("Copy failed:", e);
          showToast(e.message);
        }),
      ),
    );
  }, [article.url, showToast, t]);

  const handleAddToReadingList = useCallback(() => {
    if (!supportsReadingList || !article.url) return;
    void addToReadingList(article.url).then((result) =>
      Result.pipe(
        result,
        Result.inspect(() => showToast(t("added_to_reading_list"))),
        Result.inspectError((e) => {
          console.error("Add to reading list failed:", e);
          showToast(e.message);
        }),
      ),
    );
  }, [article.url, showToast, supportsReadingList, t]);

  useEffect(() => {
    window.addEventListener(keyboardEvents.openInAppBrowser, handleToggleBrowserOverlay);
    window.addEventListener(keyboardEvents.toggleRead, handleToggleRead);
    window.addEventListener(keyboardEvents.toggleStar, handleToggleStar);
    window.addEventListener(keyboardEvents.openExternalBrowser, handleOpenExternalBrowser);
    window.addEventListener(keyboardEvents.copyLink, handleCopyLink);
    window.addEventListener(keyboardEvents.addToReadingList, handleAddToReadingList);
    return () => {
      window.removeEventListener(keyboardEvents.openInAppBrowser, handleToggleBrowserOverlay);
      window.removeEventListener(keyboardEvents.toggleRead, handleToggleRead);
      window.removeEventListener(keyboardEvents.toggleStar, handleToggleStar);
      window.removeEventListener(keyboardEvents.openExternalBrowser, handleOpenExternalBrowser);
      window.removeEventListener(keyboardEvents.copyLink, handleCopyLink);
      window.removeEventListener(keyboardEvents.addToReadingList, handleAddToReadingList);
    };
  }, [
    handleAddToReadingList,
    handleCopyLink,
    handleOpenExternalBrowser,
    handleToggleBrowserOverlay,
    handleToggleRead,
    handleToggleStar,
  ]);

  return (
    <div data-testid="article-pane" className="flex h-full flex-1 flex-col bg-background">
      <ArticleToolbar
        article={article}
        isBrowserOpen={isBrowserOpen}
        onCloseView={handleCloseView}
        onToggleBrowserOverlay={handleToggleBrowserOverlay}
      />
      <div className="relative min-h-0 flex-1">
        {resolvedDisplay.fallbackReason === "missing_web_preview" ? (
          <div className="border-b border-border bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
            {t("web_preview_unavailable")}
          </div>
        ) : null}
        {resolvedDisplay.readerMode ? (
          <div aria-hidden={isBrowserOpen} {...(isBrowserOpen ? { inert: true } : {})} className="h-full">
            <ArticleReaderBody article={article} feedName={feedName} />
          </div>
        ) : (
          <div className="h-full bg-background" />
        )}
        {isBrowserOpen ? (
          <BrowserView
            scope={layoutMode === "wide" ? "main-stage" : "content-pane"}
            onCloseOverlay={handleToggleBrowserOverlay}
            labels={{
              closeOverlay: t("close_browser_overlay"),
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

export function ArticleView() {
  const { t } = useTranslation("reader");
  const contentMode = useUiStore((s) => s.contentMode);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const selection = useUiStore((s) => s.selection);
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const { data: articles } = useArticles(feedId);
  const { data: accountArticles } = useAccountArticles(selectedAccountId);
  const { data: tagArticles } = useArticlesByTag(tagId, selectedAccountId);
  const { data: feeds } = useFeeds(selectedAccountId);

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
      <div className="flex h-full flex-1 flex-col bg-background">
        <div className="flex flex-1 items-center justify-center text-muted-foreground">{t("article_not_found")}</div>
      </div>
    );
  }

  const article = Result.unwrap(articleResult);
  const feed = feeds?.find((candidate) => candidate.id === article.feed_id);

  return <ArticlePane article={article} feed={feed} feedName={feed?.title} />;
}
