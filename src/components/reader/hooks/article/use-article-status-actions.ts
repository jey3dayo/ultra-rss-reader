import type { UseMutationResult } from "@tanstack/react-query";
import { useCallback } from "react";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import { useUiStore } from "@/stores/ui-store";
import type { ArticleStatusToast } from "../../article-actions.types";

type ArticleStatusMutation<TVariables> = Pick<UseMutationResult<unknown, Error, TVariables, unknown>, "mutate">;

type SetReadMutation = ArticleStatusMutation<{ id: string; read: boolean }>;

type ToggleStarMutation = ArticleStatusMutation<{
  id: string;
  starred: boolean;
}>;

export type UseArticleStatusActionsParams = {
  articleId: string | null;
  isRead: boolean;
  isStarred: boolean;
  viewMode: ViewMode;
  retainOnUnstar: boolean;
  showToast: ArticleStatusToast;
  addRecentlyRead: (articleId: string) => void;
  removeRecentlyRead: (articleId: string) => void;
  retainArticle: (articleId: string) => void;
  setRead: SetReadMutation;
  toggleStar: ToggleStarMutation;
  markedReadMessage: string;
  markedUnreadMessage: string;
  starredMessage: string;
  unstarredMessage: string;
};

type UseArticleStatusActionsResult = {
  setReadStatus: (pressed: boolean) => void;
  setStarStatus: (pressed: boolean, options?: { showStatusToast?: boolean }) => void;
  handleToggleRead: () => void;
  handleToggleStar: () => void;
};

function removeRetainedArticle(articleId: string) {
  useUiStore.setState((state) => {
    if (!state.retainedArticleIds.has(articleId)) {
      return state;
    }

    const retainedArticleIds = new Set(state.retainedArticleIds);
    retainedArticleIds.delete(articleId);
    return { retainedArticleIds };
  });
}

export function useArticleStatusActions({
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
  markedReadMessage,
  markedUnreadMessage,
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

      const shouldRollbackRetainedArticle =
        pressed && viewMode === "unread" && !useUiStore.getState().retainedArticleIds.has(articleId);
      retainIfNeeded(pressed);
      setRead.mutate(
        { id: articleId, read: pressed },
        {
          onSuccess: () => {
            if (pressed) {
              addRecentlyRead(articleId);
            } else {
              removeRecentlyRead(articleId);
            }
            showToast(pressed ? markedReadMessage : markedUnreadMessage);
          },
          onError: (error) => {
            if (shouldRollbackRetainedArticle) {
              removeRetainedArticle(articleId);
            }
            showToast(error.message);
          },
        },
      );
    },
    [
      addRecentlyRead,
      articleId,
      markedReadMessage,
      markedUnreadMessage,
      removeRecentlyRead,
      retainIfNeeded,
      setRead,
      showToast,
      viewMode,
    ],
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
            if (!pressed && retainOnUnstar) {
              retainArticle(articleId);
            }
            if (options?.showStatusToast) {
              showToast(pressed ? starredMessage : unstarredMessage);
            }
          },
          onError: (error) => {
            showToast(error.message);
          },
        },
      );
    },
    [articleId, retainArticle, retainOnUnstar, showToast, starredMessage, toggleStar, unstarredMessage],
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
