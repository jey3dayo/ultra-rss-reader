import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function createMutation<TArgs>(
  mutationFn: (args: TArgs) => Result.ResultAsync<unknown, { message: string }>,
  invalidate: (qc: QueryClient) => void,
) {
  return function useGeneratedMutation() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (args: TArgs) => mutationFn(args).then(Result.unwrap()),
      onSuccess: () => invalidate(qc),
    });
  };
}
