import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";

function requireQueryId(id: string | null): string {
  if (!id || id.trim().length === 0) {
    throw new Error("Query id is required when the query is enabled.");
  }

  return id;
}

function hasQueryId(id: string | null): boolean {
  return id !== null && id.trim().length > 0;
}

export function createQuery<TData, TId extends string | null>(
  queryKey: string,
  fetcher: (id: string) => Result.ResultAsync<TData, { message: string }>,
) {
  return function useGeneratedQuery(id: TId) {
    return useQuery({
      queryKey: [queryKey, id],
      queryFn: () => fetcher(requireQueryId(id)).then(Result.unwrap()),
      enabled: hasQueryId(id),
    });
  };
}
