import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function createMutation<TArgs, TData = void>(
  mutationFn: (args: TArgs) => Result.ResultAsync<TData, { message: string }>,
  invalidate: (qc: QueryClient, args: TArgs, data: TData) => void | Promise<void>,
) {
  return function useGeneratedMutation() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (args: TArgs) => mutationFn(args).then(Result.unwrap()),
      onSuccess: async (data, args) => {
        // Generated mutation invalidation is strict: rejection keeps the mutation in an error state.
        // Callers that should stay successful must use log-only invalidation helpers inside this callback.
        await invalidate(qc, args, data);
      },
    });
  };
}
