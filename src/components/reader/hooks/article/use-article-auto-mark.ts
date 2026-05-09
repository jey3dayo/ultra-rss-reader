import type { UseMutationResult } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { AfterReadingPreference } from "@/schemas/preferences";
import { useUiStore } from "@/stores/ui-store";
import type { ArticleStatusToast } from "../../article-actions.types";

type ArticleStatusMutation<TVariables> = Pick<UseMutationResult<unknown, Error, TVariables, unknown>, "mutate">;

type UseArticleAutoMarkParams = {
  articleId: string;
  isRead: boolean;
  afterReading: AfterReadingPreference;
  viewMode: ViewMode;
  retainArticle: (articleId: string) => void;
  addRecentlyRead: (articleId: string) => void;
  removeRecentlyRead?: (articleId: string) => void;
  setRead: ArticleStatusMutation<{ id: string; read: boolean }>;
  showToast: ArticleStatusToast;
};

type DelayedAfterReadingPreference = Exclude<UseArticleAutoMarkParams["afterReading"], "never" | "immediately">;

const delayedAutoMarkTimeoutsMs = {
  after_0_3s: 300,
  after_0_5s: 500,
  after_1s: 1000,
} satisfies Record<DelayedAfterReadingPreference, number>;

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

export function useArticleAutoMark({
  articleId,
  isRead,
  afterReading,
  viewMode,
  retainArticle,
  addRecentlyRead,
  setRead,
  showToast,
}: UseArticleAutoMarkParams) {
  const autoMarkedArticleIdRef = useRef<string | null>(null);
  const latestArticleStateRef = useRef({ articleId, viewMode });
  const pendingAutoMarkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  latestArticleStateRef.current = { articleId, viewMode };

  useEffect(() => {
    if (pendingAutoMarkTimeoutRef.current !== null) {
      clearTimeout(pendingAutoMarkTimeoutRef.current);
      pendingAutoMarkTimeoutRef.current = null;
    }

    if (isRead && autoMarkedArticleIdRef.current === articleId) {
      autoMarkedArticleIdRef.current = null;
      return;
    }

    if (afterReading === "never" || isRead || autoMarkedArticleIdRef.current === articleId) {
      return;
    }

    const markArticleAsRead = () => {
      autoMarkedArticleIdRef.current = articleId;
      pendingAutoMarkTimeoutRef.current = null;

      const shouldRollbackRetainedArticle =
        viewMode === "unread" && !useUiStore.getState().retainedArticleIds.has(articleId);
      if (viewMode === "unread") {
        retainArticle(articleId);
      }

      setRead.mutate(
        {
          id: articleId,
          read: true,
        },
        {
          onSuccess: () => {
            addRecentlyRead(articleId);
          },
          onError: (error) => {
            const latestArticleState = latestArticleStateRef.current;
            const isLatestArticleState =
              latestArticleState.articleId === articleId && latestArticleState.viewMode === viewMode;
            if (autoMarkedArticleIdRef.current === articleId) {
              autoMarkedArticleIdRef.current = null;
            }
            if (!isLatestArticleState) {
              return;
            }
            if (shouldRollbackRetainedArticle) {
              removeRetainedArticle(articleId);
            }
            showToast(error.message);
          },
        },
      );
    };

    if (afterReading === "immediately") {
      markArticleAsRead();
      return;
    }

    pendingAutoMarkTimeoutRef.current = setTimeout(markArticleAsRead, delayedAutoMarkTimeoutsMs[afterReading]);

    return () => {
      if (pendingAutoMarkTimeoutRef.current !== null) {
        clearTimeout(pendingAutoMarkTimeoutRef.current);
        pendingAutoMarkTimeoutRef.current = null;
      }
    };
  }, [addRecentlyRead, afterReading, articleId, isRead, retainArticle, setRead, showToast, viewMode]);
}
