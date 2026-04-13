import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSetRead } from "@/hooks/use-articles";
import type { ArticlePaneControllerResult, ArticlePaneProps } from "./article-view.types";
import { useArticleAutoMark } from "./use-article-auto-mark";
import { useArticleBrowserOverlay } from "./use-article-browser-overlay";
import { useArticleToolbarControls } from "./use-article-toolbar-controls";
import { useArticleViewUiState } from "./use-article-view-ui-state";

export function useArticlePaneController({ article, feed }: ArticlePaneProps): ArticlePaneControllerResult {
  const { t } = useTranslation("reader");
  const {
    layoutMode,
    contentMode,
    browserUrl,
    clearArticle,
    showToast,
    addRecentlyRead,
    retainArticle,
    viewMode,
    setFocusedPane,
    afterReading,
  } = useArticleViewUiState();
  const { isBrowserOpen, resolvedDisplay, handleCloseBrowserOverlay, handleToggleBrowserOverlay } =
    useArticleBrowserOverlay({
      articleId: article.id,
      articleUrl: article.url,
      browserUrl,
      contentMode,
      feed,
    });
  const actionStripProps = useArticleToolbarControls({
    article,
    isBrowserOpen,
    onToggleBrowserOverlay: handleToggleBrowserOverlay,
    keyboardShortcuts: {
      onToggleBrowserOverlay: handleToggleBrowserOverlay,
      onCloseBrowserOverlay: handleCloseBrowserOverlay,
    },
  });
  const setRead = useSetRead();

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
      setFocusedPane("list");
    }
  }, [clearArticle, layoutMode, setFocusedPane]);

  return {
    toolbarProps: {
      article,
      isBrowserOpen,
      onCloseView: handleCloseView,
      onToggleBrowserOverlay: handleToggleBrowserOverlay,
    },
    browserOverlayProps: {
      onCloseOverlay: handleCloseBrowserOverlay,
      showBrowserView: isBrowserOpen,
    },
    browserOverlayActionStripProps: {
      ...actionStripProps,
      labels: {
        ...actionStripProps.labels,
        previewToggleOn: t("web_preview_mode"),
      },
    },
    showWebPreviewUnavailableWarning: resolvedDisplay.fallbackReason === "missing_web_preview",
    webPreviewUnavailableLabel: t("web_preview_unavailable"),
    showReaderBody: resolvedDisplay.readerMode,
    readerBodyProps: {
      "aria-hidden": isBrowserOpen,
      ...(isBrowserOpen ? { inert: true } : {}),
    },
  };
}
