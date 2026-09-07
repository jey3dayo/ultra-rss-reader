import type { UseMutationResult } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef } from "react";
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

// The auto-mark target as of the last *commit*, recorded by a layout effect. Identity plus
// eligibility: every field here is a value the scheduling effect below reads when it decides to
// keep, cancel, or re-arm a delayed mark, so a change to any of them invalidates a timer that was
// scheduled for the previous target.
type CommittedAutoMarkTarget = {
  commitGeneration: number;
  articleId: string;
  selectedAccountId: string | null;
  viewMode: ViewMode;
  isAutoMarkEligible: boolean;
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
  // Generation of the scheduling effect below (one per effect run). Distinct from
  // commitGenerationRef, which counts commit boundaries: this one can advance without a commit
  // (an unrelated dependency such as a new callback identity re-runs the effect), and a commit can
  // advance commitGenerationRef before this effect's cleanup has run at all. Do not conflate them.
  const autoMarkGenerationRef = useRef(0);
  const commitGenerationRef = useRef(0);
  const committedAutoMarkTargetRef = useRef<CommittedAutoMarkTarget | null>(null);
  const autoMarkOwnerKey = getAutoMarkOwnerKey(selectedAccountId, articleId);
  const { mutate } = setRead;
  // Same condition the scheduling effect uses to arm a delayed mark, minus the two inputs that are
  // not render values and therefore have no commit boundary: the module-level manual-unread
  // suppression key and autoMarkedOwnerKeyRef.
  const isAutoMarkEligible = !isRead && articleEngagement === "reading" && afterReading !== "never";

  // Commit-boundary gate for a delayed auto-mark dispatch.
  //
  // A passive effect's cleanup is not guaranteed to have run by the time a timer scheduled in an
  // earlier commit fires: passive effects may be flushed after paint, so between "the next article
  // is committed" and "this hook's passive cleanup runs" there is a window in which the stale timer
  // still owns pendingAutoMarkTimeoutRef. Declaration order between two passive effects only fixes
  // their order inside one flush; it does not stop a timer callback that lands before that flush.
  // A layout effect always runs inside the commit itself, so recording the committed target here
  // gives the timer callback a value it can compare against.
  // See https://react.dev/reference/react/useEffect and
  // https://react.dev/reference/react/useLayoutEffect.
  //
  // Deliberately minimal: scheduling and diagnostics stay in the passive effect below so commits
  // stay cheap.
  useLayoutEffect(() => {
    commitGenerationRef.current += 1;
    committedAutoMarkTargetRef.current = {
      commitGeneration: commitGenerationRef.current,
      articleId,
      selectedAccountId,
      viewMode,
      isAutoMarkEligible,
    };

    // Stop a timer that was scheduled for the previous committed target from firing at all. The
    // pending refs are left in place on purpose so the passive cleanup that follows still records
    // exactly one cancelled(effect_cleanup) event for that attempt.
    const pendingTimeout = pendingAutoMarkTimeoutRef.current;
    if (pendingTimeout !== null) {
      clearTimeout(pendingTimeout);
    }

    return () => {
      // Unmount (or a target change) invalidates every committed target: a callback that fires
      // before the passive cleanup finds no target and dispatches nothing.
      commitGenerationRef.current += 1;
      committedAutoMarkTargetRef.current = null;

      const pendingTimeoutOnCleanup = pendingAutoMarkTimeoutRef.current;
      if (pendingTimeoutOnCleanup !== null) {
        clearTimeout(pendingTimeoutOnCleanup);
      }
    };
  }, [articleId, isAutoMarkEligible, selectedAccountId, viewMode]);

  // Latest passive-flushed render state, used only for the post-settle stale-owner decisions in
  // onSuccess / onError / isStaleOwner. Kept separate from committedAutoMarkTargetRef on purpose:
  // that one carries eligibility, and reusing it here would make isRead flipping to true after a
  // successful mutation newly suppress addRecentlyRead.
  useEffect(() => {
    latestArticleStateRef.current = { articleId, selectedAccountId, viewMode };
  }, [articleId, selectedAccountId, viewMode]);

  useEffect(() => {
    autoMarkGenerationRef.current += 1;
    const autoMarkGeneration = autoMarkGenerationRef.current;
    // The layout effect above already ran for this commit, so this is the target this attempt is
    // scheduled for.
    const committedAutoMarkTargetAtSchedule = committedAutoMarkTargetRef.current;

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

      // True only while the commit this attempt was scheduled for is still the committed one.
      const isScheduledCommitStillCurrent = () => {
        const committedTarget = committedAutoMarkTargetRef.current;
        return (
          committedTarget !== null &&
          committedAutoMarkTargetAtSchedule !== null &&
          committedTarget.commitGeneration === committedAutoMarkTargetAtSchedule.commitGeneration &&
          committedTarget.articleId === articleId &&
          committedTarget.selectedAccountId === selectedAccountId &&
          committedTarget.viewMode === viewMode &&
          committedTarget.isAutoMarkEligible
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

          // Commit-boundary guard, checked before the dispatched diagnostic, the optimistic retain,
          // and the mutation: a newer article/account/view/eligibility has already been committed,
          // so this attempt must leave no trace here. Every ref is left untouched, so the pending
          // passive cleanup still records its single cancelled(effect_cleanup) for this requestId.
          if (!isScheduledCommitStillCurrent()) {
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
