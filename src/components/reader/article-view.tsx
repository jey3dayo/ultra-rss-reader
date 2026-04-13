import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto, FeedDto } from "@/api/tauri-commands";
import { useSetRead, useToggleStar } from "@/hooks/use-articles";
import { usePlatformStore } from "@/stores/platform-store";
import { resolvePreferenceValue, usePreferencesStore } from "@/stores/preferences-store";
import { useUiStore } from "@/stores/ui-store";
import { FeedCleanupPage } from "../feed-cleanup/feed-cleanup-page";
import { ArticleEmptyStateView } from "./article-empty-state-view";
import { ArticleReaderBody } from "./article-reader-body";
import { ArticleShareMenu } from "./article-share-menu";
import { ArticleToolbarActionStrip, ArticleToolbarView, type ArticleToolbarViewLabels } from "./article-toolbar-view";
import {
  ArticleEmptyStateShell,
  ArticleNotFoundStateView,
  BrowserOnlyStateView,
  BrowserOverlaySurface,
} from "./article-view-state";
import { useArticleActions } from "./use-article-actions";
import { useArticleAutoMark } from "./use-article-auto-mark";
import { useArticleBrowserOverlay } from "./use-article-browser-overlay";
import { useArticleViewSelection } from "./use-article-view-selection";

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
  const { setReadStatus, setStarStatus, handleOpenExternalBrowser, handleCopyLink } = useArticleActions({
    article,
    viewMode,
    supportsReadingList,
    showToast,
    addRecentlyRead,
    retainArticle,
    setRead,
    toggleStar,
  });

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
      onToggleRead={setReadStatus}
      onToggleStar={(pressed) => setStarStatus(pressed, { showStatusToast: true })}
      onCopyLink={handleCopyLink}
      onOpenInBrowser={onToggleBrowserOverlay}
      onOpenInExternalBrowser={handleOpenExternalBrowser}
    />
  );
}

function EmptyState() {
  const { t } = useTranslation("reader");
  return (
    <ArticleEmptyStateShell
      toolbar={
        <ArticleToolbar article={null} isBrowserOpen={false} onCloseView={() => {}} onToggleBrowserOverlay={() => {}} />
      }
      body={
        <ArticleEmptyStateView
          message={t("select_article_to_read")}
          hints={[t("empty_state_pick_from_list"), t("empty_state_search_hint"), t("empty_state_web_preview_hint")]}
        />
      }
    />
  );
}

function BrowserOnlyState() {
  const closeBrowser = useUiStore((s) => s.closeBrowser);

  return <BrowserOnlyStateView onCloseOverlay={closeBrowser} />;
}

export function ArticlePane({ article, feed, feedName }: { article: ArticleDto; feed?: FeedDto; feedName?: string }) {
  const { t } = useTranslation("reader");
  const layoutMode = useUiStore((s) => s.layoutMode);
  const contentMode = useUiStore((s) => s.contentMode);
  const browserUrl = useUiStore((s) => s.browserUrl);
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
  const { isBrowserOpen, resolvedDisplay, handleCloseBrowserOverlay, handleToggleBrowserOverlay } =
    useArticleBrowserOverlay({
      articleId: article.id,
      articleUrl: article.url,
      browserUrl,
      contentMode,
      feed,
    });
  const { setReadStatus, setStarStatus, handleOpenExternalBrowser, handleCopyLink } = useArticleActions({
    article,
    viewMode,
    supportsReadingList,
    showToast,
    addRecentlyRead,
    retainArticle,
    setRead,
    toggleStar,
    keyboardShortcuts: {
      onToggleBrowserOverlay: handleToggleBrowserOverlay,
      onCloseBrowserOverlay: handleCloseBrowserOverlay,
    },
  });

  useArticleAutoMark({
    articleId: article.id,
    isRead: article.is_read,
    afterReading,
    viewMode,
    retainArticle,
    addRecentlyRead,
    setRead,
    showToast,
  });

  const handleCloseView = useCallback(() => {
    clearArticle();
    if (layoutMode !== "wide") {
      useUiStore.getState().setFocusedPane("list");
    }
  }, [clearArticle, layoutMode]);

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
      onToggleRead={setReadStatus}
      onToggleStar={(pressed) => setStarStatus(pressed, { showStatusToast: true })}
      onCopyLink={handleCopyLink}
      onOpenInBrowser={handleToggleBrowserOverlay}
      onOpenInExternalBrowser={handleOpenExternalBrowser}
    />
  );

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
  const selectionState = useArticleViewSelection();

  if (selectionState.kind === "feed-cleanup") {
    return <FeedCleanupPage />;
  }

  if (selectionState.kind === "browser-only") {
    return <BrowserOnlyState />;
  }

  if (selectionState.kind === "empty") {
    return <EmptyState />;
  }

  if (selectionState.kind === "not-found") {
    return <ArticleNotFoundStateView message={t("article_not_found")} />;
  }

  return (
    <ArticlePane article={selectionState.article} feed={selectionState.feed} feedName={selectionState.feed?.title} />
  );
}
