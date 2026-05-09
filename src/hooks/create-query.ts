import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";

function requireQueryId(id: string | null): string {
  const normalizedId = id?.trim() ?? "";
  if (normalizedId.length === 0) {
    throw new Error("Query id is required when the query is enabled.");
  }

  return normalizedId;
}

function hasQueryId(id: string | null): boolean {
  return id !== null && id.trim().length > 0;
}

export function createQuery<TData, TId extends string | null>(
  queryKey: string,
  fetcher: (id: string) => Result.ResultAsync<TData, { message: string }>,
) {
  return function useGeneratedQuery(id: TId) {
    const queryId = hasQueryId(id) ? requireQueryId(id) : null;
    return useQuery({
      queryKey: [queryKey, queryId],
      queryFn: () => fetcher(requireQueryId(queryId)).then(Result.unwrap()),
      enabled: queryId !== null,
    });
  };
}
