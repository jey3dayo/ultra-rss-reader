import { useCallback } from "react";
import type { UseArticleStatusActionsParams, UseArticleStatusActionsResult } from "./article-actions.types";

export function useArticleStatusActions({
  articleId,
  isRead,
  isStarred,
  viewMode,
  showToast,
  addRecentlyRead,
  retainArticle,
  setRead,
  toggleStar,
  starredMessage,
  unstarredMessage,
}: UseArticleStatusActionsParams): UseArticleStatusActionsResult {
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
              showToast(pressed ? starredMessage : unstarredMessage);
            }
          },
        },
      );
    },
    [articleId, retainArticle, showToast, starredMessage, toggleStar, unstarredMessage, viewMode],
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

  return {
    setReadStatus,
    setStarStatus,
    handleToggleRead,
    handleToggleStar,
  };
}
