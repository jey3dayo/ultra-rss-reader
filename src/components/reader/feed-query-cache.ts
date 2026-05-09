import type { MutableRefObject } from "react";

export type {
  InvalidateFeedQueriesOptions,
  InvalidateFeedQueriesOptions as FeedMutationCacheInvalidationOptions,
} from "@/lib/query/query-invalidation";
export {
  invalidateArticleQueries,
  invalidateFeedQueries,
} from "@/lib/query/query-invalidation";

type FeedMutationOptimisticRollbackParams<TResult> = {
  run: () => Promise<TResult>;
  rollback: () => void;
  shouldRollback: (result: TResult) => boolean;
};

export async function runFeedMutationWithOptimisticRollback<TResult>({
  run,
  rollback,
  shouldRollback,
}: FeedMutationOptimisticRollbackParams<TResult>): Promise<TResult> {
  try {
    const result = await run();
    if (shouldRollback(result)) {
      rollback();
    }
    return result;
  } catch (error) {
    rollback();
    throw error;
  }
}

type LatestFeedMutationGuardParams = {
  latestRequestIdRef: MutableRefObject<number>;
};

export function startLatestFeedMutation({ latestRequestIdRef }: LatestFeedMutationGuardParams): number {
  const requestId = latestRequestIdRef.current + 1;
  latestRequestIdRef.current = requestId;
  return requestId;
}

export function isLatestFeedMutation(
  { latestRequestIdRef }: LatestFeedMutationGuardParams,
  requestId: number,
): boolean {
  return latestRequestIdRef.current === requestId;
}
