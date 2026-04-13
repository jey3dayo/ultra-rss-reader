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

  useEffect(() => {
    if (afterReading !== "mark_as_read" || isRead || autoMarkedArticleIdRef.current === articleId) {
      return;
    }

    autoMarkedArticleIdRef.current = articleId;

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
  }, [addRecentlyRead, afterReading, articleId, isRead, retainArticle, setRead, showToast, viewMode]);
}
