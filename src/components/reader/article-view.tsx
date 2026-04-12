import { Result } from "@praha/byethrow";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { addToReadingList, closeBrowserWebview, copyToClipboard, openInBrowser } from "@/api/tauri-commands";
import { ScrollArea } from "@/components/ui/scroll-area";
import { APP_EVENTS } from "@/constants/events";
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
import { flushPendingBrowserCloseAction } from "@/lib/actions";
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
import { emitDebugInputTrace } from "@/lib/debug-input-trace";
import { keyboardEvents } from "@/lib/keyboard-shortcuts";
import { usePlatformStore } from "@/stores/platform-store";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { FeedCleanupPage } from "../feed-cleanup/feed-cleanup-page";
import { ArticleContentView } from "./article-content-view";
import { ArticleEmptyStateView } from "./article-empty-state-view";
import { ArticleMetaView } from "./article-meta-view";
import { ArticleShareMenu } from "./article-share-menu";
import { type ArticleTagPickerTagView, ArticleTagPickerView } from "./article-tag-picker-view";
import { ArticleToolbarActionStrip, ArticleToolbarView, type ArticleToolbarViewLabels } from "./article-toolbar-view";
import { BrowserView } from "./browser-view";

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

export function ArticleToolbar({
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
  const supportsReadingList = usePlatformStore((s) => s.platform.capabilities.supports_reading_list);

  const retainIfNeeded = useCallback(
    (nextRead: boolean) => {
      if (!article) {
        return;
      }

      // Retain before mutating so unread view does not drop the article during
      // the refetch triggered by mark-as-read. It should disappear only after
      // the user changes feed/view and retainedArticleIds is cleared.
      if (nextRead && viewMode === "unread") {
        retainArticle(article.id);
      }
    },
    [article, retainArticle, viewMode],
  );

  return (
    <ArticleToolbarView
      showCloseButton={article !== null && !isBrowserOpen}
      hideActionStrip={isBrowserOpen}
      canToggleRead={article !== null}
      canToggleStar={article !== null}
      isRead={article?.is_read ?? false}
      isStarred={article?.is_starred ?? false}
      isBrowserOpen={isBrowserOpen}
      hideBrowserOverlayActions={isBrowserOpen}
      showCopyLinkButton={actionCopyLink === "true"}
      canCopyLink={Boolean(article?.url)}
      showOpenInBrowserButton
      canOpenInBrowser={Boolean(article?.url)}
      showOpenInExternalBrowserButton
      canOpenInExternalBrowser={Boolean(article?.url)}
      shareMenuControl={
        <ArticleShareMenu
          article={article}
          supportsReadingList={supportsReadingList}
          showToast={showToast}
          labels={{
            share: t("share"),
            copyLink: t("copy_link"),
            addToReadingList: t("add_to_reading_list"),
            addedToReadingList: t("added_to_reading_list"),
            shareViaEmail: t("share_via_email"),
            linkCopied: t("link_copied"),
          }}
        />
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
        retainIfNeeded(pressed);
        setRead.mutate(
          { id: article.id, read: pressed },
          {
            onSuccess: () => {
              if (pressed) {
                addRecentlyRead(article.id);
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
      <ArticleToolbar article={null} isBrowserOpen={false} onCloseView={() => {}} onToggleBrowserOverlay={() => {}} />
      <ArticleEmptyStateView
        message={t("select_article_to_read")}
        hints={[t("empty_state_pick_from_list"), t("empty_state_search_hint"), t("empty_state_web_preview_hint")]}
      />
    </div>
  );
}

type BrowserOverlaySurfaceProps = {
  children?: ReactNode;
  onCloseOverlay: () => void;
  showBrowserView?: boolean;
  toolbarActions?: ReactNode;
};

function BrowserOverlaySurface({
  children,
  onCloseOverlay,
  showBrowserView = true,
  toolbarActions,
}: BrowserOverlaySurfaceProps) {
  const { t } = useTranslation("reader");

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {children}
      {showBrowserView ? (
        <BrowserView
          scope="main-stage"
          onCloseOverlay={onCloseOverlay}
          labels={{
            closeOverlay: t("close_browser_overlay"),
          }}
          toolbarActions={toolbarActions}
        />
      ) : null}
    </div>
  );
}

function BrowserOnlyState() {
  const closeBrowser = useUiStore((s) => s.closeBrowser);

  return (
    <div className="relative flex h-full flex-1 flex-col bg-background">
      <BrowserOverlaySurface onCloseOverlay={closeBrowser} />
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
        sectionTitle: t("tags_section_title"),
        sectionHint: t("tags_section_hint"),
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
  const contentContainerRef = useRef<HTMLDivElement | null>(null);
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
    const contentContainer = contentContainerRef.current;
    if (!contentContainer || !articleContentHtml) {
      return;
    }

    const anchors = Array.from(contentContainer.querySelectorAll<HTMLAnchorElement>("a[href]"));
    const handleContentClick = (event: MouseEvent) => {
      const anchor = event.currentTarget;
      if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) {
        return;
      }
      event.preventDefault();
      openArticleUrl(anchor.href, event.metaKey, event.ctrlKey);
    };

    for (const anchor of anchors) {
      anchor.addEventListener("click", handleContentClick);
    }

    return () => {
      for (const anchor of anchors) {
        anchor.removeEventListener("click", handleContentClick);
      }
    };
  }, [articleContentHtml, openArticleUrl]);

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

        <div ref={contentContainerRef}>
          <ArticleContentView thumbnailUrl={article.thumbnail} contentHtml={articleContentHtml} feedName={feedName} />
        </div>
      </article>
    </ScrollArea>
  );
}

export function ArticlePane({ article, feed, feedName }: { article: ArticleDto; feed?: FeedDto; feedName?: string }) {
  const { t } = useTranslation("reader");
  const layoutMode = useUiStore((s) => s.layoutMode);
  const contentMode = useUiStore((s) => s.contentMode);
  const browserUrl = useUiStore((s) => s.browserUrl);
  const openBrowser = useUiStore((s) => s.openBrowser);
  const closeBrowser = useUiStore((s) => s.closeBrowser);
  const setBrowserCloseInFlight = useUiStore((s) => s.setBrowserCloseInFlight);
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
  const preserveBrowserOverlayOnNextArticleRef = useRef(false);
  const autoMarkedArticleIdRef = useRef<string | null>(null);
  const wasBrowserOpenRef = useRef(false);
  const isBrowserOpen = contentMode === "browser";
  const intendedBrowserUrl = article.url;
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

  const retainIfNeeded = useCallback(
    (nextRead: boolean) => {
      if (nextRead && viewMode === "unread") {
        retainArticle(article.id);
      }
    },
    [article.id, retainArticle, viewMode],
  );

  const previousArticleIdRef = useRef(article.id);

  const focusSelectedArticleRow = useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    const selectedArticleTarget = document.querySelector<HTMLElement>(`[data-article-id="${article.id}"]`);
    if (!selectedArticleTarget || selectedArticleTarget.hasAttribute("disabled")) {
      return;
    }

    useUiStore.getState().setFocusedPane("list");
    selectedArticleTarget.focus({ preventScroll: true });
  }, [article.id]);

  useEffect(() => {
    const markKeyboardNavigationIntent = () => {
      preserveBrowserOverlayOnNextArticleRef.current = webPreviewModeOverride === "on";
    };

    window.addEventListener(APP_EVENTS.navigateArticle, markKeyboardNavigationIntent);
    return () => {
      window.removeEventListener(APP_EVENTS.navigateArticle, markKeyboardNavigationIntent);
    };
  }, [webPreviewModeOverride]);

  useEffect(() => {
    if (previousArticleIdRef.current === article.id) {
      return;
    }

    previousArticleIdRef.current = article.id;
    const shouldPreserveBrowserOverlay =
      webPreviewModeOverride === "on" && preserveBrowserOverlayOnNextArticleRef.current;
    preserveBrowserOverlayOnNextArticleRef.current = false;
    if (shouldPreserveBrowserOverlay) {
      return;
    }
    setReaderModeOverride(null);
    setWebPreviewModeOverride(null);
  }, [article.id, webPreviewModeOverride]);

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
    if (afterReading !== "mark_as_read" || article.is_read || autoMarkedArticleIdRef.current === article.id) {
      return;
    }

    autoMarkedArticleIdRef.current = article.id;
    retainIfNeeded(true);
    setRead.mutate(
      {
        id: article.id,
        read: true,
      },
      {
        onSuccess: () => {
          addRecentlyRead(article.id);
        },
        onError: (error) => {
          showToast(error.message);
        },
      },
    );
  }, [addRecentlyRead, afterReading, article.id, article.is_read, retainIfNeeded, setRead, showToast]);

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
        const selectedArticleTarget = document.querySelector<HTMLElement>(`[data-article-id="${article.id}"]`);
        if (selectedArticleTarget && !selectedArticleTarget.hasAttribute("disabled")) {
          useUiStore.getState().setFocusedPane("list");
          selectedArticleTarget.focus({ preventScroll: true });
          return;
        }

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
  }, [article.id, isBrowserOpen]);

  const handleCloseView = useCallback(() => {
    clearArticle();
    if (layoutMode !== "wide") {
      useUiStore.getState().setFocusedPane("list");
    }
  }, [clearArticle, layoutMode]);

  const handleOpenBrowserOverlay = useCallback(() => {
    rememberOverlayFocusReturnTarget();
    setReaderModeOverride(requestedDisplay.readerMode ? "on" : "off");
    setWebPreviewModeOverride("on");
  }, [rememberOverlayFocusReturnTarget, requestedDisplay.readerMode]);

  const finalizeCloseBrowserOverlay = useCallback(() => {
    useUiStore.getState().setFocusedPane("list");
    focusSelectedArticleRow();
    setReaderModeOverride(requestedDisplay.readerMode ? "on" : "off");
    setWebPreviewModeOverride("off");
    closeBrowser();
    requestAnimationFrame(() => {
      focusSelectedArticleRow();
      flushPendingBrowserCloseAction();
    });
  }, [closeBrowser, focusSelectedArticleRow, requestedDisplay.readerMode]);

  const handleCloseBrowserOverlay = useCallback(() => {
    if (useUiStore.getState().browserCloseInFlight) {
      emitDebugInputTrace("close-browser ignored (in-flight)");
      return;
    }
    emitDebugInputTrace("close-browser start");
    setBrowserCloseInFlight(true);
    void closeBrowserWebview()
      .then((result) =>
        Result.pipe(
          result,
          Result.inspectError((error) => {
            console.error("Failed to close embedded browser webview before returning to reader mode:", error);
          }),
        ),
      )
      .finally(() => {
        emitDebugInputTrace("close-browser finalize");
        finalizeCloseBrowserOverlay();
      });
  }, [finalizeCloseBrowserOverlay, setBrowserCloseInFlight]);

  const handleToggleBrowserOverlay = useCallback(() => {
    if (requestedDisplay.webPreviewMode) {
      handleCloseBrowserOverlay();
      return;
    }

    handleOpenBrowserOverlay();
  }, [handleCloseBrowserOverlay, handleOpenBrowserOverlay, requestedDisplay.webPreviewMode]);

  const handleToggleRead = useCallback(() => {
    const markingAsRead = !article.is_read;
    retainIfNeeded(markingAsRead);
    setRead.mutate(
      { id: article.id, read: markingAsRead },
      {
        onSuccess: () => {
          if (markingAsRead) {
            addRecentlyRead(article.id);
          }
        },
      },
    );
  }, [addRecentlyRead, article.id, article.is_read, retainIfNeeded, setRead]);

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

  const toolbarLabels: ArticleToolbarViewLabels = {
    closeView: t("close_view"),
    toggleRead: t("toggle_read"),
    toggleStar: t("toggle_star"),
    previewToggleOff: t("open_in_browser"),
    previewToggleOn: t("close_browser_overlay"),
    copyLink: t("copy_link"),
    openInExternalBrowser: t("open_in_external_browser"),
  };

  const overlayToolbarActions = (
    <ArticleToolbarActionStrip
      canToggleRead
      canToggleStar
      isRead={article.is_read}
      isStarred={article.is_starred}
      isBrowserOpen
      showCopyLinkButton={resolvePreferenceValue(prefs, "action_copy_link") === "true"}
      canCopyLink={Boolean(article.url)}
      showOpenInBrowserButton
      canOpenInBrowser={Boolean(article.url)}
      showOpenInExternalBrowserButton
      canOpenInExternalBrowser={Boolean(article.url)}
      shareMenuControl={
        <ArticleShareMenu
          article={article}
          supportsReadingList={supportsReadingList}
          showToast={showToast}
          labels={{
            share: t("share"),
            copyLink: t("copy_link"),
            addToReadingList: t("add_to_reading_list"),
            addedToReadingList: t("added_to_reading_list"),
            shareViaEmail: t("share_via_email"),
            linkCopied: t("link_copied"),
          }}
        />
      }
      labels={{
        ...toolbarLabels,
        previewToggleOn: t("web_preview_mode"),
      }}
      onToggleRead={(pressed) => {
        if (!article) return;
        retainIfNeeded(pressed);
        setRead.mutate(
          { id: article.id, read: pressed },
          {
            onSuccess: () => {
              if (pressed) {
                addRecentlyRead(article.id);
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
      onCopyLink={handleCopyLink}
      onOpenInBrowser={handleToggleBrowserOverlay}
      onOpenInExternalBrowser={handleOpenExternalBrowser}
    />
  );

  useEffect(() => {
    window.addEventListener(keyboardEvents.openInAppBrowser, handleToggleBrowserOverlay);
    window.addEventListener(keyboardEvents.closeBrowserOverlay, handleCloseBrowserOverlay);
    window.addEventListener(keyboardEvents.toggleRead, handleToggleRead);
    window.addEventListener(keyboardEvents.toggleStar, handleToggleStar);
    window.addEventListener(keyboardEvents.openExternalBrowser, handleOpenExternalBrowser);
    window.addEventListener(keyboardEvents.copyLink, handleCopyLink);
    window.addEventListener(keyboardEvents.addToReadingList, handleAddToReadingList);
    return () => {
      window.removeEventListener(keyboardEvents.openInAppBrowser, handleToggleBrowserOverlay);
      window.removeEventListener(keyboardEvents.closeBrowserOverlay, handleCloseBrowserOverlay);
      window.removeEventListener(keyboardEvents.toggleRead, handleToggleRead);
      window.removeEventListener(keyboardEvents.toggleStar, handleToggleStar);
      window.removeEventListener(keyboardEvents.openExternalBrowser, handleOpenExternalBrowser);
      window.removeEventListener(keyboardEvents.copyLink, handleCopyLink);
      window.removeEventListener(keyboardEvents.addToReadingList, handleAddToReadingList);
    };
  }, [
    handleAddToReadingList,
    handleCloseBrowserOverlay,
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
      <BrowserOverlaySurface
        onCloseOverlay={handleCloseBrowserOverlay}
        showBrowserView={isBrowserOpen}
        toolbarActions={overlayToolbarActions}
      >
        {resolvedDisplay.fallbackReason === "missing_web_preview" ? (
          <div className="border-b border-border bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
            {t("web_preview_unavailable")}
          </div>
        ) : null}
        {resolvedDisplay.readerMode ? (
          <div
            aria-hidden={isBrowserOpen}
            {...(isBrowserOpen ? { inert: true } : {})}
            className="min-h-0 flex-1"
            data-testid="article-reader-body"
          >
            <ArticleReaderBody article={article} feedName={feedName} />
          </div>
        ) : (
          <div className="h-full bg-background" />
        )}
      </BrowserOverlaySurface>
    </div>
  );
}

export function ArticleView() {
  const { t } = useTranslation("reader");
  const contentMode = useUiStore((s) => s.contentMode);
  const browserUrl = useUiStore((s) => s.browserUrl);
  const feedCleanupOpen = useUiStore((s) => s.feedCleanupOpen);
  const selectedAccountId = useUiStore((s) => s.selectedAccountId);
  const selectedArticleId = useUiStore((s) => s.selectedArticleId);
  const selection = useUiStore((s) => s.selection);
  const feedId = selection.type === "feed" ? selection.feedId : null;
  const tagId = selection.type === "tag" ? selection.tagId : null;
  const { data: articles } = useArticles(feedId);
  const { data: accountArticles } = useAccountArticles(selectedAccountId);
  const { data: tagArticles } = useArticlesByTag(tagId, selectedAccountId);
  const { data: feeds } = useFeeds(selectedAccountId);

  if (feedCleanupOpen) {
    return <FeedCleanupPage />;
  }

  if (contentMode === "browser" && browserUrl && !selectedArticleId) {
    return <BrowserOnlyState />;
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
      <div className="flex h-full flex-1 flex-col bg-background">
        <div className="flex flex-1 items-center justify-center text-muted-foreground">{t("article_not_found")}</div>
      </div>
    );
  }

  const article = Result.unwrap(articleResult);
  const feed = feeds?.find((candidate) => candidate.id === article.feed_id);

  return <ArticlePane article={article} feed={feed} feedName={feed?.title} />;
}
