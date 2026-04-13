import type { UseMutationResult } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

type SetReadMutation = UseMutationResult<unknown, Error, { id: string; read: boolean }, unknown>;

type UseArticleAutoMarkParams = {
  articleId: string;
  isRead: boolean;
  afterReading: string;
  viewMode: "all" | "unread" | "starred";
  retainArticle: (articleId: string) => void;
  addRecentlyRead: (articleId: string) => void;
  setRead: SetReadMutation;
  showToast: (message: string) => void;
};

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
