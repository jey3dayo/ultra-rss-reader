import { useEffect, useRef } from "react";
import type { UseArticleAutoMarkParams } from "./article-actions.types";

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

    pendingAutoMarkTimeoutRef.current = setTimeout(markArticleAsRead, 1000);

    return () => {
      if (pendingAutoMarkTimeoutRef.current !== null) {
        clearTimeout(pendingAutoMarkTimeoutRef.current);
        pendingAutoMarkTimeoutRef.current = null;
      }
    };
  }, [addRecentlyRead, afterReading, articleId, isRead, retainArticle, setRead, showToast, viewMode]);
}
