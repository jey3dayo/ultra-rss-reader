import { Copy } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useArticleAutoMark } from "@/components/reader/hooks/article/use-article-auto-mark";
import { useArticleBrowserOverlay } from "@/components/reader/hooks/article/use-article-browser-overlay";
import { useArticleToolbarControls } from "@/components/reader/hooks/article/use-article-toolbar-controls";
import { useArticleViewUiState } from "@/components/reader/hooks/article/use-article-view-ui-state";
import { useRecordArticleView, useSetRead } from "@/hooks/use-articles";
import type { ArticlePaneProps, ArticlePaneToolbarState } from "../../article-pane-view";
import type { BrowserOverlayToolbarAction } from "../../browser-view.types";

type ArticlePaneBrowserOverlayState = {
  onCloseOverlay: () => void;
  onBrowserWebviewClosed: () => void;
  showBrowserView?: boolean;
};

type ArticlePaneControllerResult = {
  toolbarProps: ArticlePaneToolbarState;
  browserOverlayProps: ArticlePaneBrowserOverlayState;
  browserOverlayToolbarActions?: BrowserOverlayToolbarAction[];
  showWebPreviewUnavailableWarning: boolean;
  webPreviewUnavailableLabel: string;
  showReaderBody: boolean;
  readerBodyProps: {
    onOpenArticleTitleInWebPreview: () => void;
    "aria-hidden": boolean;
    inert?: true;
  };
};

export function useArticlePaneController({ article, feed }: ArticlePaneProps): ArticlePaneControllerResult {
  const { t } = useTranslation("reader");
  const {
    layoutMode,
    contentMode,
    browserUrl,
    selection,
    clearArticle,
    showToast,
    addRecentlyRead,
    retainArticle,
    viewMode,
    setFocusedPane,
    afterReading,
  } = useArticleViewUiState();
  const {
    isBrowserOpen,
    resolvedDisplay,
    handleOpenBrowserOverlay,
    handleCloseBrowserOverlay,
    handleBrowserWebviewClosed,
    handleToggleBrowserOverlay,
  } = useArticleBrowserOverlay({
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
  const recordArticleView = useRecordArticleView();
  const isRecentSmartView = selection.type === "smart" && selection.kind === "recent";
  const recordedSelectionRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (isRecentSmartView || !feed?.account_id) {
      return;
    }

    const selectionKey = `${feed.account_id}:${article.id}`;
    if (recordedSelectionRef.current === selectionKey) {
      return;
    }
    recordedSelectionRef.current = selectionKey;

    recordArticleView.mutate(
      { accountId: feed.account_id, articleId: article.id },
      {
        onError: (error) => {
          recordedSelectionRef.current = null;
          showToast(error.message);
        },
      },
    );
  }, [article.id, feed?.account_id, isRecentSmartView, recordArticleView, showToast]);

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
      onBrowserWebviewClosed: handleBrowserWebviewClosed,
      showBrowserView: isBrowserOpen,
    },
    browserOverlayToolbarActions: actionStripProps.actionOptions.canCopyLink
      ? [
          {
            key: "copy-link",
            label: actionStripProps.labels.copyLink,
            onClick: actionStripProps.onCopyLink,
            disabled: !actionStripProps.actionOptions.canCopyLink,
            icon: <Copy aria-hidden="true" className="size-4" />,
          },
        ]
      : undefined,
    showWebPreviewUnavailableWarning: resolvedDisplay.fallbackReason === "missing_web_preview",
    webPreviewUnavailableLabel: t("web_preview_unavailable"),
    showReaderBody: resolvedDisplay.readerMode,
    readerBodyProps: {
      onOpenArticleTitleInWebPreview: handleOpenBrowserOverlay,
      "aria-hidden": isBrowserOpen,
      ...(isBrowserOpen ? { inert: true } : {}),
    },
  };
}
