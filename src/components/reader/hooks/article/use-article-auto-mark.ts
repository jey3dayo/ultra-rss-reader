import type { UseMutationResult } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { planOptimisticRetainOnRead } from "@/lib/articles/article-read-projection";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { AfterReadingPreference } from "@/schemas/preference-values";
import { useUiStore } from "@/stores/ui-store";
import type { ArticleEngagement } from "@/stores/ui-store.types";
import type { ArticleStatusToast } from "../../article-browser-actions";
import { removeRetainedArticle } from "../../retained-articles";

type ArticleStatusMutation<TVariables> = Pick<UseMutationResult<unknown, Error, TVariables, unknown>, "mutate">;

type UseArticleAutoMarkParams = {
  articleId: string;
  isRead: boolean;
  articleEngagement: ArticleEngagement;
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

let manualUnreadAutoMarkSuppressionKey: string | null = null;

function getAutoMarkOwnerKey(accountId: string | null, articleId: string) {
  return `${accountId ?? ""}:${articleId}`;
}

export function suppressAutoMarkAfterManualUnread(accountId: string | null, articleId: string): void {
  manualUnreadAutoMarkSuppressionKey = getAutoMarkOwnerKey(accountId, articleId);
}

export function clearManualUnreadAutoMarkSuppression(accountId: string | null, articleId: string): void {
  if (manualUnreadAutoMarkSuppressionKey === getAutoMarkOwnerKey(accountId, articleId)) {
    manualUnreadAutoMarkSuppressionKey = null;
  }
}

export function clearManualUnreadAutoMarkSuppressionsForTests(): void {
  manualUnreadAutoMarkSuppressionKey = null;
}

export function useArticleAutoMark({
  articleId,
  isRead,
  articleEngagement,
  afterReading,
  viewMode,
  retainArticle,
  addRecentlyRead,
  setRead,
  showToast,
}: UseArticleAutoMarkParams) {
  const selectedAccountId = useUiStore((state) => state.selectedAccountId);
  const autoMarkedOwnerKeyRef = useRef<string | null>(null);
  const latestArticleStateRef = useRef({ articleId, selectedAccountId, viewMode });
  const pendingAutoMarkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoMarkGenerationRef = useRef(0);
  const autoMarkOwnerKey = getAutoMarkOwnerKey(selectedAccountId, articleId);

  latestArticleStateRef.current = { articleId, selectedAccountId, viewMode };

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

    clearPendingAutoMarkTimeout();

    if (manualUnreadAutoMarkSuppressionKey !== null && manualUnreadAutoMarkSuppressionKey !== autoMarkOwnerKey) {
      manualUnreadAutoMarkSuppressionKey = null;
    }

    if (isRead) {
      if (autoMarkedOwnerKeyRef.current === autoMarkOwnerKey) {
        autoMarkedOwnerKeyRef.current = null;
      }
    } else if (
      articleEngagement === "reading" &&
      afterReading !== "never" &&
      manualUnreadAutoMarkSuppressionKey !== autoMarkOwnerKey &&
      autoMarkedOwnerKeyRef.current !== autoMarkOwnerKey
    ) {
      const markArticleAsRead = () => {
        autoMarkedOwnerKeyRef.current = autoMarkOwnerKey;
        pendingAutoMarkTimeoutRef.current = null;

        const isLatestAutoMark = () => {
          const latestArticleState = latestArticleStateRef.current;
          return (
            autoMarkGenerationRef.current === autoMarkGeneration &&
            latestArticleState.articleId === articleId &&
            latestArticleState.selectedAccountId === selectedAccountId &&
            latestArticleState.viewMode === viewMode
          );
        };
        const retainPlan = planOptimisticRetainOnRead({
          viewMode,
          markingRead: true,
          isAlreadyRetained: useUiStore.getState().retainedArticleIds.has(articleId),
        });
        if (retainPlan.shouldRetain) {
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
              if (autoMarkedOwnerKeyRef.current === autoMarkOwnerKey) {
                autoMarkedOwnerKeyRef.current = null;
              }
              if (retainPlan.shouldRollbackOnError) {
                removeRetainedArticle(articleId);
              }
              showToast(error.message);
            },
          },
        );
      };

      if (afterReading === "immediately") {
        markArticleAsRead();
      } else if (typeof setTimeout === "function") {
        const timeout = setTimeout(() => {
          // Timer guard pattern: only the latest scheduled timeout may mutate read state.
          if (pendingAutoMarkTimeoutRef.current !== timeout) {
            return;
          }

          markArticleAsRead();
        }, delayedAutoMarkTimeoutsMs[afterReading]);
        pendingAutoMarkTimeoutRef.current = timeout;
      }
    }

    return () => {
      if (autoMarkGenerationRef.current === autoMarkGeneration) {
        autoMarkGenerationRef.current += 1;
      }

      const pendingTimeout = pendingAutoMarkTimeoutRef.current;
      if (pendingTimeout === null) {
        return;
      }

      clearTimeout(pendingTimeout);
      pendingAutoMarkTimeoutRef.current = null;
    };
  }, [
    addRecentlyRead,
    afterReading,
    articleEngagement,
    articleId,
    autoMarkOwnerKey,
    isRead,
    retainArticle,
    selectedAccountId,
    setRead,
    showToast,
    viewMode,
  ]);
}
