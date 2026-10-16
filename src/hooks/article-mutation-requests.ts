import type { QueryKey } from "@tanstack/react-query";
import type { OldUnreadDays, OldUnreadScopeKind } from "@/api/tauri-commands";
import { normalizeQueryAccountId } from "@/lib/query/query-invalidation";

export type SetReadMutationInput = {
  id: string;
  read: boolean;
  /**
   * Present only for auto-mark calls (see use-article-auto-mark.ts); manual read/unread actions
   * never set this. When present, mutationFn records read-state diagnostics (settled/pending_slow)
   * at the mutationFn Promise boundary so they are observed even if the calling component unmounts.
   */
  diagnostics?: {
    requestId: string;
    generation: number;
    isStaleOwner: () => boolean;
  };
};

export type ToggleStarMutationInput = {
  id: string;
  starred: boolean;
};

export type RecordArticleViewMutationInput = {
  accountId: string;
  articleId: string;
};

export type MarkOldUnreadReadMutationInput = {
  scopeKind: OldUnreadScopeKind;
  targetId: string;
  olderThanDays: OldUnreadDays;
};

export type ClearArticleViewHistoryContext = {
  previousRecentArticleQueries: Array<{
    queryKey: QueryKey;
    previousData: unknown;
    optimisticData: unknown;
  }>;
};

export type ArticleMutationRequestToken = {
  instanceId: symbol;
  requestId: number;
  order: number;
};

type ArticleMutationRequestRecord<TVariables> = {
  token: ArticleMutationRequestToken;
  variables: TVariables;
  status: "pending" | "success" | "failure";
  applied: boolean;
};

export type ArticleMutationRequestState<TVariables> = {
  nextOrder: number;
  requests: Array<ArticleMutationRequestRecord<TVariables>>;
};

// The reader and settings surfaces can mount separate mutation hooks for the same article.
// Share request state by article while keeping request counters local to each hook instance.
export const readRequestStatesByArticleId = new Map<string, ArticleMutationRequestState<SetReadMutationInput>>();
export const starRequestStatesByArticleId = new Map<string, ArticleMutationRequestState<ToggleStarMutationInput>>();

export function registerArticleMutationRequest<TVariables>(
  statesByArticleId: Map<string, ArticleMutationRequestState<TVariables>>,
  articleId: string,
  instanceId: symbol,
  requestId: number,
  variables: TVariables,
): ArticleMutationRequestToken {
  const state = statesByArticleId.get(articleId) ?? { nextOrder: 0, requests: [] };
  const requestToken = { instanceId, requestId, order: state.nextOrder };
  state.nextOrder += 1;
  state.requests.push({ token: requestToken, variables, status: "pending", applied: false });
  statesByArticleId.set(articleId, state);
  return requestToken;
}

export function settleArticleMutationRequest<TVariables>(
  statesByArticleId: Map<string, ArticleMutationRequestState<TVariables>>,
  articleId: string,
  requestToken: ArticleMutationRequestToken,
  status: "success" | "failure",
): TVariables | null {
  const state = statesByArticleId.get(articleId);
  const settledRequest = state?.requests.find((request) => request.token === requestToken);
  if (!state || !settledRequest || settledRequest.status !== "pending") {
    return null;
  }

  settledRequest.status = status;

  let effectiveSuccess: ArticleMutationRequestRecord<TVariables> | null = null;
  for (const request of state.requests) {
    if (request.status !== "success") {
      continue;
    }

    const hasPendingNewerRequest = state.requests.some(
      (candidate) => candidate.status === "pending" && candidate.token.order > request.token.order,
    );
    if (!hasPendingNewerRequest && (effectiveSuccess === null || request.token.order > effectiveSuccess.token.order)) {
      effectiveSuccess = request;
    }
  }

  let variablesToApply: TVariables | null = null;
  if (effectiveSuccess !== null && !effectiveSuccess.applied) {
    effectiveSuccess.applied = true;
    variablesToApply = effectiveSuccess.variables;
  }

  if (state.requests.every((request) => request.status !== "pending")) {
    statesByArticleId.delete(articleId);
  }

  return variablesToApply;
}

export function normalizeManualArticleQueryId(value: string | null): string | null {
  return normalizeQueryAccountId(value);
}
