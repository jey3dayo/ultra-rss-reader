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
  const autoMarkGenerationRef = useRef(0);

  latestArticleStateRef.current = { articleId, viewMode };

  useEffect(() => {
    autoMarkGenerationRef.current += 1;
    const autoMarkGeneration = autoMarkGenerationRef.current;
    const clearPendingAutoMarkTimeout = () => {
      const pendingTimeout = pendingAutoMarkTimeoutRef.current;
      if (pendingTimeout === null) {
        return;
      }

      clearTimeout(pendingTimeout);
      pendingAutoMarkTimeoutRef.current = null;
    };
    const cleanupAutoMarkEffect = () => {
      if (autoMarkGenerationRef.current === autoMarkGeneration) {
        autoMarkGenerationRef.current += 1;
      }
      clearPendingAutoMarkTimeout();
    };

    clearPendingAutoMarkTimeout();

    if (isRead && autoMarkedArticleIdRef.current === articleId) {
      autoMarkedArticleIdRef.current = null;
      return cleanupAutoMarkEffect;
    }

    if (afterReading === "never" || isRead || autoMarkedArticleIdRef.current === articleId) {
      return cleanupAutoMarkEffect;
    }

    const markArticleAsRead = () => {
      autoMarkedArticleIdRef.current = articleId;
      pendingAutoMarkTimeoutRef.current = null;

      const isLatestAutoMark = () => {
        const latestArticleState = latestArticleStateRef.current;
        return (
          autoMarkGenerationRef.current === autoMarkGeneration &&
          latestArticleState.articleId === articleId &&
          latestArticleState.viewMode === viewMode
        );
      };
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
            if (!isLatestAutoMark()) {
              return;
            }
            addRecentlyRead(articleId);
          },
          onError: (error) => {
            if (!isLatestAutoMark()) {
              return;
            }
            if (autoMarkedArticleIdRef.current === articleId) {
              autoMarkedArticleIdRef.current = null;
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
      return cleanupAutoMarkEffect;
    }

    if (typeof setTimeout !== "function") {
      return cleanupAutoMarkEffect;
    }

    const timeout = setTimeout(() => {
      // Timer guard pattern: only the latest scheduled timeout may mutate read state.
      if (pendingAutoMarkTimeoutRef.current !== timeout) {
        return;
      }

      markArticleAsRead();
    }, delayedAutoMarkTimeoutsMs[afterReading]);
    pendingAutoMarkTimeoutRef.current = timeout;

    return cleanupAutoMarkEffect;
  }, [addRecentlyRead, afterReading, articleId, isRead, retainArticle, setRead, showToast, viewMode]);
}
