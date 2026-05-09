import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";

function normalizeQueryId(id: string | null): string | null {
  const normalizedId = id?.trim() ?? "";
  if (normalizedId.length === 0) {
    return null;
  }

  return normalizedId;
}

export function createQuery<TData, TId extends string | null>(
  queryKey: string,
  fetcher: (id: string) => Result.ResultAsync<TData, { message: string }>,
) {
  return function useGeneratedQuery(id: TId) {
    const queryId = normalizeQueryId(id);
    return useQuery<TData, Error, TData, [string, string | null]>({
      queryKey: [queryKey, queryId],
      queryFn: () => {
        if (queryId === null) {
          console.warn("[createQuery] queryFn called while generated query is disabled:", { queryKey });
          return Promise.reject(new Error("Query id is required when the query is enabled."));
        }

        return fetcher(queryId).then(Result.unwrap());
      },
      enabled: queryId !== null,
      retry: false,
    });
  };
}
