import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import { addArticleToReadingList, copyArticleLink, openArticleInExternalBrowser } from "./article-browser-actions";
import { type ArticleActionKeyboardShortcuts, useArticleActionShortcuts } from "./use-article-action-shortcuts";
import { useArticleStatusActions } from "./use-article-status-actions";

type ShowToast = (message: string) => void;

type UseArticleActionsParams = {
  article: ArticleDto | null;
  viewMode: "all" | "unread" | "starred";
  supportsReadingList: boolean;
  showToast: ShowToast;
  addRecentlyRead: (articleId: string) => void;
  retainArticle: (articleId: string) => void;
  setRead: Parameters<typeof useArticleStatusActions>[0]["setRead"];
  toggleStar: Parameters<typeof useArticleStatusActions>[0]["toggleStar"];
  keyboardShortcuts?: ArticleActionKeyboardShortcuts;
};

type UseArticleActionsResult = {
  setReadStatus: (pressed: boolean) => void;
  setStarStatus: (pressed: boolean, options?: { showStatusToast?: boolean }) => void;
  handleToggleRead: () => void;
  handleToggleStar: () => void;
  handleOpenExternalBrowser: () => void;
  handleCopyLink: () => void;
  handleAddToReadingList: () => void;
};

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
