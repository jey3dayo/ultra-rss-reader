import type { UseMutationResult } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { AfterReadingPreference } from "@/schemas/preferences";
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
  const pendingAutoMarkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pendingAutoMarkTimeoutRef.current !== null) {
      clearTimeout(pendingAutoMarkTimeoutRef.current);
      pendingAutoMarkTimeoutRef.current = null;
    }

    if (afterReading === "never" || isRead || autoMarkedArticleIdRef.current === articleId) {
      return;
    }

    const markArticleAsRead = () => {
      autoMarkedArticleIdRef.current = articleId;
      pendingAutoMarkTimeoutRef.current = null;

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
