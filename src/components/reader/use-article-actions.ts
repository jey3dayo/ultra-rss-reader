import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { UseArticleActionsParams, UseArticleActionsResult } from "./article-actions.types";
import { addArticleToReadingList, copyArticleLink, openArticleInExternalBrowser } from "./article-browser-actions";
import { useArticleActionShortcuts } from "./use-article-action-shortcuts";
import { useArticleStatusActions } from "./use-article-status-actions";

export function useArticleActions({
  article,
  viewMode,
  supportsReadingList,
  showToast,
  addRecentlyRead,
  retainArticle,
  setRead,
  toggleStar,
  keyboardShortcuts,
}: UseArticleActionsParams): UseArticleActionsResult {
  const { t } = useTranslation("reader");
  const articleId = article?.id ?? null;
  const articleUrl = article?.url ?? null;
  const isRead = article?.is_read ?? false;
  const isStarred = article?.is_starred ?? false;

  const { setReadStatus, setStarStatus, handleToggleRead, handleToggleStar } = useArticleStatusActions({
    articleId,
    isRead,
    isStarred,
    viewMode,
    showToast,
    addRecentlyRead,
    retainArticle,
    setRead,
    toggleStar,
    starredMessage: t("article_starred"),
    unstarredMessage: t("article_unstarred"),
  });

  const handleOpenExternalBrowser = useCallback(() => {
    if (!articleUrl) {
      return;
    }

    void openArticleInExternalBrowser(articleUrl, showToast);
  }, [articleUrl, showToast]);

  const handleCopyLink = useCallback(() => {
    if (!articleUrl) {
      return;
    }

    void copyArticleLink(articleUrl, {
      showToast,
      successMessage: t("link_copied"),
    });
  }, [articleUrl, showToast, t]);

  const handleAddToReadingList = useCallback(() => {
    if (!supportsReadingList || !articleUrl) {
      return;
    }

    void addArticleToReadingList(articleUrl, {
      showToast,
      successMessage: t("added_to_reading_list"),
    });
  }, [articleUrl, showToast, supportsReadingList, t]);

  useArticleActionShortcuts({
    keyboardShortcuts,
    onToggleRead: handleToggleRead,
    onToggleStar: handleToggleStar,
    onOpenExternalBrowser: handleOpenExternalBrowser,
    onCopyLink: handleCopyLink,
    onAddToReadingList: handleAddToReadingList,
  });

  return {
    setReadStatus,
    setStarStatus,
    handleToggleRead,
    handleToggleStar,
    handleOpenExternalBrowser,
    handleCopyLink,
    handleAddToReadingList,
  };
}
