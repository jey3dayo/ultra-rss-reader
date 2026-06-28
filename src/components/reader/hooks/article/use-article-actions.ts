import type { UseMutationResult } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import {
  type ArticleActionKeyboardShortcuts,
  useArticleActionShortcuts,
} from "@/components/reader/hooks/article/use-article-action-shortcuts";
import { useArticleStatusActions } from "@/components/reader/hooks/article/use-article-status-actions";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import {
  type ArticleStatusToast,
  addArticleToReadingList,
  copyArticleLink,
  openArticleInExternalBrowser,
} from "../../article-browser-actions";

type ArticleStatusMutation<TVariables> = Pick<UseMutationResult<unknown, Error, TVariables, unknown>, "mutate">;

type UseArticleActionsParams = {
  article: ArticleDto | null;
  viewMode: ViewMode;
  retainOnUnstar: boolean;
  supportsReadingList: boolean;
  showToast: ArticleStatusToast;
  addRecentlyRead: (articleId: string) => void;
  removeRecentlyRead: (articleId: string) => void;
  retainArticle: (articleId: string) => void;
  setRead: ArticleStatusMutation<{ id: string; read: boolean }>;
  toggleStar: ArticleStatusMutation<{ id: string; starred: boolean }>;
  keyboardShortcuts?: ArticleActionKeyboardShortcuts;
  enableKeyboardShortcuts?: boolean;
};

type UseArticleActionsResult = {
  setReadStatus: (pressed: boolean) => void;
  setStarStatus: (pressed: boolean) => void;
  handleToggleRead: () => void;
  handleToggleStar: () => void;
  handleOpenExternalBrowser: () => void;
  handleCopyLink: () => void;
  handleAddToReadingList: () => void;
};

export function useArticleActions({
  article,
  viewMode,
  retainOnUnstar,
  supportsReadingList,
  showToast,
  addRecentlyRead,
  removeRecentlyRead,
  retainArticle,
  setRead,
  toggleStar,
  keyboardShortcuts,
  enableKeyboardShortcuts = true,
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
    retainOnUnstar,
    showToast,
    addRecentlyRead,
    removeRecentlyRead,
    retainArticle,
    setRead,
    toggleStar,
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

  useArticleActionShortcuts(
    enableKeyboardShortcuts
      ? {
          keyboardShortcuts,
          selectedArticleUrl: articleUrl,
          onToggleRead: handleToggleRead,
          onToggleStar: handleToggleStar,
          onOpenExternalBrowser: handleOpenExternalBrowser,
          onCopyLink: handleCopyLink,
          onAddToReadingList: handleAddToReadingList,
        }
      : null,
  );

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
