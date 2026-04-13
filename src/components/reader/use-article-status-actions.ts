import type { UseMutationResult } from "@tanstack/react-query";
import { useCallback } from "react";

type SetReadMutation = UseMutationResult<unknown, Error, { id: string; read: boolean }, unknown>;
type ToggleStarMutation = UseMutationResult<unknown, Error, { id: string; starred: boolean }, unknown>;

type UseArticleStatusActionsParams = {
  articleId: string | null;
  isRead: boolean;
  isStarred: boolean;
  viewMode: "all" | "unread" | "starred";
  showToast: (message: string) => void;
  addRecentlyRead: (articleId: string) => void;
  retainArticle: (articleId: string) => void;
  setRead: SetReadMutation;
  toggleStar: ToggleStarMutation;
  starredMessage: string;
  unstarredMessage: string;
};

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
}: UseArticleStatusActionsParams) {
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
  } as const;
}
