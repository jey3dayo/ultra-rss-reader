import type { UseMutationResult } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ArticleDto } from "@/api/tauri-commands";
import { addArticleToReadingList, copyArticleLink, openArticleInExternalBrowser } from "./article-browser-actions";
import { type ArticleActionKeyboardShortcuts, useArticleActionShortcuts } from "./use-article-action-shortcuts";

type SetReadMutation = UseMutationResult<unknown, Error, { id: string; read: boolean }, unknown>;
type ToggleStarMutation = UseMutationResult<unknown, Error, { id: string; starred: boolean }, unknown>;
type ShowToast = (message: string) => void;

type UseArticleActionsParams = {
  article: ArticleDto | null;
  viewMode: "all" | "unread" | "starred";
  supportsReadingList: boolean;
  showToast: ShowToast;
  addRecentlyRead: (articleId: string) => void;
  retainArticle: (articleId: string) => void;
  setRead: SetReadMutation;
  toggleStar: ToggleStarMutation;
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

  const retainIfNeeded = useCallback(
    (nextRead: boolean) => {
      if (!articleId) {
        return;
      }

      if (nextRead && viewMode === "unread") {
        retainArticle(articleId);
      }
    },
    [articleId, retainArticle, viewMode],
  );

  const setReadStatus = useCallback(
    (pressed: boolean) => {
      if (!articleId) {
        return;
      }

      retainIfNeeded(pressed);
      setRead.mutate(
        { id: articleId, read: pressed },
        {
          onSuccess: () => {
            if (pressed) {
              addRecentlyRead(articleId);
            }
          },
        },
      );
    },
    [addRecentlyRead, articleId, retainIfNeeded, setRead],
  );

  const setStarStatus = useCallback(
    (pressed: boolean, options?: { showStatusToast?: boolean }) => {
      if (!articleId) {
        return;
      }

      toggleStar.mutate(
        { id: articleId, starred: pressed },
        {
          onSuccess: () => {
            if (!pressed && viewMode === "starred") {
              retainArticle(articleId);
            }
            if (options?.showStatusToast) {
              showToast(pressed ? t("article_starred") : t("article_unstarred"));
            }
          },
        },
      );
    },
    [articleId, retainArticle, showToast, t, toggleStar, viewMode],
  );

  const handleToggleRead = useCallback(() => {
    if (!articleId) {
      return;
    }

    setReadStatus(!isRead);
  }, [articleId, isRead, setReadStatus]);

  const handleToggleStar = useCallback(() => {
    if (!articleId) {
      return;
    }

    setStarStatus(!isStarred);
  }, [articleId, isStarred, setStarStatus]);

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
