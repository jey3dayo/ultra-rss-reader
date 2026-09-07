import type { UseMutationResult } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { SetReadMutationInput } from "@/hooks/use-articles";
import { planOptimisticRetainOnRead } from "@/lib/articles/article-read-projection";
import type { ViewMode } from "@/lib/reader/view-mode.types";
import type { AfterReadingPreference } from "@/schemas/preference-values";
import { useUiStore } from "@/stores/ui-store";
import type { ArticleEngagement } from "@/stores/ui-store.types";
import type { ArticleStatusToast } from "../../article-browser-actions";
import { removeRetainedArticle } from "../../retained-articles";
import {
  createReadDiagnosticRequestId,
  recordAutoMarkCancelled,
  recordAutoMarkDispatched,
  recordAutoMarkScheduled,
  recordAutoMarkSkipped,
} from "./read-state-diagnostics";

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
  setRead: ArticleStatusMutation<SetReadMutationInput>;
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
  const autoMarkMutationSucceededOwnerKeyRef = useRef<string | null>(null);
  const latestArticleStateRef = useRef({ articleId, selectedAccountId, viewMode });
  const pendingAutoMarkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Diagnostics for whichever attempt pendingAutoMarkTimeoutRef currently tracks; cleared together
  // with it. Read only from effect cleanup to record a "cancelled" event for a scheduled (not yet
  // dispatched) attempt.
  const pendingAutoMarkDiagnosticsRef = useRef<{ requestId: string; generation: number } | null>(null);
  const autoMarkGenerationRef = useRef(0);
  const autoMarkOwnerKey = getAutoMarkOwnerKey(selectedAccountId, articleId);
  const { mutate } = setRead;

  useEffect(() => {
    latestArticleStateRef.current = { articleId, selectedAccountId, viewMode };
  }, [articleId, selectedAccountId, viewMode]);

  useEffect(() => {
    autoMarkGenerationRef.current += 1;
    const autoMarkGeneration = autoMarkGenerationRef.current;

    const clearPendingAutoMarkTimeout = () => {
      const pendingTimeout = pendingAutoMarkTimeoutRef.current;
      pendingAutoMarkDiagnosticsRef.current = null;
      if (pendingTimeout === null) {
        return;
      }

      clearTimeout(pendingTimeout);
      pendingAutoMarkTimeoutRef.current = null;
    };

    clearPendingAutoMarkTimeout();

    if (manualUnreadAutoMarkSuppressionKey !== null) {
      if (manualUnreadAutoMarkSuppressionKey === autoMarkOwnerKey) {
        autoMarkedOwnerKeyRef.current = null;
        autoMarkMutationSucceededOwnerKeyRef.current = null;
      } else {
        manualUnreadAutoMarkSuppressionKey = null;
      }
    }

    if (isRead) {
      recordAutoMarkSkipped(createReadDiagnosticRequestId(), autoMarkGeneration, "already_read");
      if (autoMarkedOwnerKeyRef.current === autoMarkOwnerKey) {
        if (autoMarkMutationSucceededOwnerKeyRef.current !== autoMarkOwnerKey) {
          autoMarkedOwnerKeyRef.current = null;
        }
      }
    } else if (
      articleEngagement === "reading" &&
      afterReading !== "never" &&
      manualUnreadAutoMarkSuppressionKey !== autoMarkOwnerKey &&
      autoMarkedOwnerKeyRef.current !== autoMarkOwnerKey
    ) {
      const requestId = createReadDiagnosticRequestId();
      const delayMs = afterReading === "immediately" ? 0 : delayedAutoMarkTimeoutsMs[afterReading];
      recordAutoMarkScheduled(requestId, autoMarkGeneration, delayMs);

      const markArticleAsRead = (driftMs: number) => {
        recordAutoMarkDispatched(requestId, autoMarkGeneration, driftMs);
        autoMarkedOwnerKeyRef.current = autoMarkOwnerKey;
        pendingAutoMarkTimeoutRef.current = null;
        pendingAutoMarkDiagnosticsRef.current = null;

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

        mutate(
          {
            id: articleId,
            read: true,
            diagnostics: {
              requestId,
              generation: autoMarkGeneration,
              isStaleOwner: () => !isLatestAutoMark(),
            },
          },
          {
            onSuccess: () => {
              if (!isLatestAutoMark()) {
                return;
              }
              autoMarkMutationSucceededOwnerKeyRef.current = autoMarkOwnerKey;
              addRecentlyRead(articleId);
            },
            onError: (error) => {
              if (!isLatestAutoMark()) {
                return;
              }
              if (autoMarkedOwnerKeyRef.current === autoMarkOwnerKey) {
                autoMarkedOwnerKeyRef.current = null;
              }
              if (autoMarkMutationSucceededOwnerKeyRef.current === autoMarkOwnerKey) {
                autoMarkMutationSucceededOwnerKeyRef.current = null;
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
        markArticleAsRead(0);
      } else if (typeof setTimeout === "function") {
        const scheduledAt = Date.now();
        const timeout = setTimeout(() => {
          // Timer guard pattern: only the latest scheduled timeout may mutate read state.
          if (pendingAutoMarkTimeoutRef.current !== timeout) {
            return;
          }

          markArticleAsRead(Date.now() - scheduledAt - delayMs);
        }, delayMs);
        pendingAutoMarkTimeoutRef.current = timeout;
        pendingAutoMarkDiagnosticsRef.current = { requestId, generation: autoMarkGeneration };
      }
    } else {
      // Negation of the branch above, evaluated in the same priority order it checks, purely to
      // classify why auto-mark did not proceed. Diagnostics-only: no state here affects behavior.
      const skipReason =
        articleEngagement !== "reading"
          ? "not_reading"
          : afterReading === "never"
            ? "preference_never"
            : manualUnreadAutoMarkSuppressionKey === autoMarkOwnerKey
              ? "manual_unread_suppressed"
              : autoMarkedOwnerKeyRef.current === autoMarkOwnerKey
                ? "already_requested"
                : null;
      if (skipReason !== null) {
        recordAutoMarkSkipped(createReadDiagnosticRequestId(), autoMarkGeneration, skipReason);
      }
    }

    return () => {
      if (autoMarkGenerationRef.current === autoMarkGeneration) {
        autoMarkGenerationRef.current += 1;
      }

      const pendingTimeout = pendingAutoMarkTimeoutRef.current;
      const pendingDiagnostics = pendingAutoMarkDiagnosticsRef.current;
      pendingAutoMarkDiagnosticsRef.current = null;
      if (pendingTimeout === null) {
        return;
      }

      clearTimeout(pendingTimeout);
      pendingAutoMarkTimeoutRef.current = null;
      // A cleanup that still finds a pending timeout means a scheduled (not yet dispatched)
      // auto-mark attempt is being torn down. Whether this is unmount or a dependency change
      // cannot be distinguished from here, so this is always recorded as effect_cleanup rather
      // than guessed at (see tmp/read-state/design-contract.md).
      if (pendingDiagnostics !== null) {
        recordAutoMarkCancelled(pendingDiagnostics.requestId, pendingDiagnostics.generation, "effect_cleanup");
      }
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
    mutate,
    showToast,
    viewMode,
  ]);
}
