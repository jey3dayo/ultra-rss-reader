import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";

export function createQuery<TData, TId extends string | null>(
  queryKey: string,
  fetcher: (id: string) => Result.ResultAsync<TData, { message: string }>,
) {
  return function useGeneratedQuery(id: TId) {
    return useQuery({
      queryKey: [queryKey, id],
      queryFn: () => fetcher(id as string).then(Result.unwrap()),
      enabled: !!id,
    });
  };
}
