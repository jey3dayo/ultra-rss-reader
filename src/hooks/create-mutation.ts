import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function createMutation<TArgs, TData = void>(
  mutationFn: (args: TArgs) => Result.ResultAsync<TData, { message: string }>,
  invalidate: (qc: QueryClient, args: TArgs, data: TData) => void,
) {
  return function useGeneratedMutation() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (args: TArgs) => mutationFn(args).then(Result.unwrap()),
      onSuccess: (data, args) => invalidate(qc, args, data),
    });
  };
}
