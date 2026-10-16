// Article read/star/view-history mutation hooks.
import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  clearArticleViewHistory,
  markAccountRead,
  markAccountStarredRead,
  markArticleRead,
  markArticlesRead,
  markFeedRead,
  markFolderRead,
  markOldUnreadRead,
  recordArticleView,
  toggleArticleStar,
  unstarAccountArticles,
} from "@/api/tauri-commands";
import {
  classifyAppErrorForReadDiagnostics,
  READ_STATE_PENDING_SLOW_THRESHOLD_MS,
  recordAutoMarkPendingSlow,
  recordAutoMarkSettled,
} from "@/components/reader/hooks/article/read-state-diagnostics";
import {
  clearArticleQueryData,
  createInfiniteArticleQueryData,
  getRecentArticleQueryKeysForAccount,
  isAccountKnownDeleted,
  patchCachedArticleReadState,
  patchCachedArticleStarState,
  patchCachedArticlesMarkedRead,
  shouldInvalidateAfterRecordArticleView,
} from "@/hooks/article-cache-projection";
import { createMutation } from "@/hooks/create-mutation";
import { shouldRetainBulkMarkedRead } from "@/lib/articles/article-read-projection";
import { invalidateArticleMutationQueries, invalidateQueryKeysLogOnly } from "@/lib/query/query-invalidation";
import { localizeUserVisibleAppErrorMessage } from "@/lib/ui/localize-app-error-message";
import { useUiStore } from "@/stores/ui-store";
import type {
  ClearArticleViewHistoryContext,
  MarkOldUnreadReadMutationInput,
  RecordArticleViewMutationInput,
  SetReadMutationInput,
  ToggleStarMutationInput,
} from "./article-mutation-requests";
import {
  normalizeManualArticleQueryId,
  readRequestStatesByArticleId,
  registerArticleMutationRequest,
  settleArticleMutationRequest,
  starRequestStatesByArticleId,
} from "./article-mutation-requests";

export function runSetReadMutation({ id, read, diagnostics }: SetReadMutationInput) {
  if (!diagnostics) {
    return markArticleRead(id, read).then(Result.unwrap());
  }

  const { requestId, generation, isStaleOwner } = diagnostics;
  const startedAt = Date.now();
  let settled = false;
  const pendingSlowTimer = setTimeout(() => {
    if (!settled) {
      recordAutoMarkPendingSlow(requestId, generation, Date.now() - startedAt);
    }
  }, READ_STATE_PENDING_SLOW_THRESHOLD_MS);

  return markArticleRead(id, read, { requestId, source: "auto" }).then((result) => {
    settled = true;
    clearTimeout(pendingSlowTimer);
    const durationMs = Date.now() - startedAt;
    const staleOwner = isStaleOwner();
    if (Result.isSuccess(result)) {
      recordAutoMarkSettled(requestId, generation, "success", durationMs, undefined, staleOwner);
    } else {
      recordAutoMarkSettled(
        requestId,
        generation,
        "failure",
        durationMs,
        classifyAppErrorForReadDiagnostics(result.error),
        staleOwner,
      );
    }
    return Result.unwrap()(result);
  });
}

export function useSetRead() {
  const qc = useQueryClient();
  const [instanceId] = useState(() => Symbol("useSetRead"));
  const nextRequestIdRef = useRef(0);

  return useMutation({
    mutationFn: runSetReadMutation,
    onMutate: (variables) => {
      const requestId = nextRequestIdRef.current + 1;
      nextRequestIdRef.current = requestId;
      const requestToken = registerArticleMutationRequest(
        readRequestStatesByArticleId,
        variables.id,
        instanceId,
        requestId,
        variables,
      );
      return { requestToken };
    },
    onSuccess: (_data, variables, context) => {
      const variablesToApply = settleArticleMutationRequest(
        readRequestStatesByArticleId,
        variables.id,
        context.requestToken,
        "success",
      );
      if (variablesToApply === null) {
        return;
      }

      patchCachedArticleReadState(qc, variables.id, variablesToApply.read);
      invalidateArticleMutationQueries(qc, "article-read");
    },
    onError: (_error, variables, context) => {
      if (!context) {
        return;
      }

      const variablesToApply = settleArticleMutationRequest(
        readRequestStatesByArticleId,
        variables.id,
        context.requestToken,
        "failure",
      );
      if (variablesToApply === null) {
        return;
      }

      patchCachedArticleReadState(qc, variables.id, variablesToApply.read);
      invalidateArticleMutationQueries(qc, "article-read");
    },
  });
}

export const useMarkAllRead = createMutation(
  (articleIds: string[]) => markArticlesRead(articleIds),
  (qc) => invalidateArticleMutationQueries(qc, "article-read"),
);

export const useMarkAccountRead = createMutation(markAccountRead, (qc) =>
  invalidateArticleMutationQueries(qc, "article-read"),
);

export const useMarkAccountStarredRead = createMutation(markAccountStarredRead, (qc) =>
  invalidateArticleMutationQueries(qc, "article-read"),
);

export const useMarkOldUnreadRead = createMutation(
  ({ scopeKind, targetId, olderThanDays }: MarkOldUnreadReadMutationInput) =>
    markOldUnreadRead(scopeKind, targetId, olderThanDays),
  (qc) => invalidateArticleMutationQueries(qc, "article-read"),
);

export const useUnstarAccountArticles = createMutation(unstarAccountArticles, (qc) =>
  invalidateArticleMutationQueries(qc, "article-star"),
);

export function useRecordArticleView() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ accountId, articleId }: RecordArticleViewMutationInput) => {
      const normalizedAccountId = normalizeManualArticleQueryId(accountId);
      const normalizedArticleId = normalizeManualArticleQueryId(articleId);

      if (!normalizedAccountId || !normalizedArticleId) {
        return Promise.resolve(null);
      }

      return recordArticleView(normalizedAccountId, normalizedArticleId).then((result) => Result.unwrap(result));
    },
    onSuccess: (_data, variables) => {
      const normalizedAccountId = normalizeManualArticleQueryId(variables.accountId);
      const normalizedArticleId = normalizeManualArticleQueryId(variables.articleId);

      if (
        !normalizedAccountId ||
        !normalizedArticleId ||
        !shouldInvalidateAfterRecordArticleView(qc, normalizedAccountId)
      ) {
        return;
      }

      invalidateArticleMutationQueries(qc, "article-view-recorded");
    },
  });
}

export function useClearArticleViewHistory() {
  const { t } = useTranslation("reader");
  const qc = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);

  return useMutation<number, Error, string, ClearArticleViewHistoryContext>({
    mutationFn: (accountId: string) => {
      const normalizedAccountId = normalizeManualArticleQueryId(accountId);

      if (!normalizedAccountId || isAccountKnownDeleted(qc, normalizedAccountId)) {
        return Promise.resolve(0);
      }

      return clearArticleViewHistory(normalizedAccountId).then((result) => Result.unwrap(result));
    },
    onMutate: async (accountId) => {
      const normalizedAccountId = normalizeManualArticleQueryId(accountId);
      if (!normalizedAccountId) {
        return { previousRecentArticleQueries: [] };
      }

      const recentArticleQueryKeys = getRecentArticleQueryKeysForAccount(normalizedAccountId);
      await Promise.all(recentArticleQueryKeys.map((queryKey) => qc.cancelQueries({ queryKey })));
      const previousRecentArticleQueries = recentArticleQueryKeys.map((queryKey) => ({
        queryKey,
        previousData: qc.getQueryData(queryKey),
        optimisticData: undefined,
      }));
      for (const recentArticleQuery of previousRecentArticleQueries) {
        const optimisticData =
          clearArticleQueryData(recentArticleQuery.previousData) ?? createInfiniteArticleQueryData();
        qc.setQueryData(recentArticleQuery.queryKey, optimisticData);
        recentArticleQuery.optimisticData = qc.getQueryData(recentArticleQuery.queryKey);
      }

      return { previousRecentArticleQueries };
    },
    onSuccess: (_data, accountId) => {
      const normalizedAccountId = normalizeManualArticleQueryId(accountId);
      if (!normalizedAccountId || isAccountKnownDeleted(qc, normalizedAccountId)) {
        return;
      }

      invalidateQueryKeysLogOnly(qc, getRecentArticleQueryKeysForAccount(normalizedAccountId), {
        actionOwner: "article-mutation",
      });
    },
    onError: (error, _accountId, context) => {
      for (const { queryKey, previousData, optimisticData } of context?.previousRecentArticleQueries ?? []) {
        if (qc.getQueryData(queryKey) === optimisticData) {
          qc.setQueryData(queryKey, previousData);
        }
      }
      showToast(t("clear_recent_history_failed", { message: localizeUserVisibleAppErrorMessage(error.message) }));
    },
  });
}

export function patchMarkedArticlesReadAndInvalidate(qc: QueryClient, markedArticleIds: readonly string[]) {
  // Bulk mark-read retention policy contract: see article-read-projection.ts.
  const { viewMode, retainArticles } = useUiStore.getState();
  if (shouldRetainBulkMarkedRead(viewMode)) {
    retainArticles(markedArticleIds);
  }

  // Patch cached lists synchronously so unread dots clear even when the
  // background refetch is slow or fails; invalidation stays the durable sync path.
  patchCachedArticlesMarkedRead(qc, new Set(markedArticleIds));
  invalidateArticleMutationQueries(qc, "article-read");
}

export const useMarkFeedRead = createMutation(markFeedRead, (qc, _feedId, markedArticleIds) =>
  patchMarkedArticlesReadAndInvalidate(qc, markedArticleIds),
);

export const useMarkFolderRead = createMutation(markFolderRead, (qc, _folderId, markedArticleIds) =>
  patchMarkedArticlesReadAndInvalidate(qc, markedArticleIds),
);
export function useToggleStar() {
  const qc = useQueryClient();
  const [instanceId] = useState(() => Symbol("useToggleStar"));
  const nextRequestIdRef = useRef(0);

  return useMutation({
    mutationFn: ({ id, starred }: ToggleStarMutationInput) => toggleArticleStar(id, starred).then(Result.unwrap()),
    onMutate: (variables) => {
      const requestId = nextRequestIdRef.current + 1;
      nextRequestIdRef.current = requestId;
      const requestToken = registerArticleMutationRequest(
        starRequestStatesByArticleId,
        variables.id,
        instanceId,
        requestId,
        variables,
      );
      return { requestToken };
    },
    onSuccess: (_data, variables, context) => {
      const variablesToApply = settleArticleMutationRequest(
        starRequestStatesByArticleId,
        variables.id,
        context.requestToken,
        "success",
      );
      if (variablesToApply === null) {
        return;
      }

      patchCachedArticleStarState(qc, variables.id, variablesToApply.starred);
      invalidateArticleMutationQueries(qc, "article-star");
    },
    onError: (_error, variables, context) => {
      if (!context) {
        return;
      }

      const variablesToApply = settleArticleMutationRequest(
        starRequestStatesByArticleId,
        variables.id,
        context.requestToken,
        "failure",
      );
      if (variablesToApply === null) {
        return;
      }

      patchCachedArticleStarState(qc, variables.id, variablesToApply.starred);
      invalidateArticleMutationQueries(qc, "article-star");
    },
  });
}
