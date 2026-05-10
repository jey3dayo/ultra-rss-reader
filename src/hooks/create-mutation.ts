import { Result } from "@praha/byethrow";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { AppError } from "@/api/schemas/error";
import type { QueryInvalidationActionOwner } from "@/lib/query/query-invalidation";
import { logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";
import { AppErrorClassificationError } from "@/lib/ui-errors";

type CreateMutationInvalidationDiagnostics = {
  actionOwner: QueryInvalidationActionOwner;
  queryKeys: ReadonlyArray<QueryKey>;
};

type GeneratedMutationError = { message: string; type?: AppError["type"] };

function unwrapGeneratedMutationResult<TData>(result: Result.Result<TData, GeneratedMutationError>): TData {
  if (Result.isFailure(result)) {
    if (result.error.type !== undefined) {
      throw new AppErrorClassificationError({
        type: result.error.type,
        message: result.error.message,
      });
    }
    throw new Error(result.error.message);
  }

  return result.value;
}

export function createMutation<TArgs, TData = void>(
  mutationFn: (args: TArgs) => Result.ResultAsync<TData, GeneratedMutationError>,
  invalidate: (qc: QueryClient, args: TArgs, data: TData) => void | Promise<void>,
  invalidationDiagnostics?: CreateMutationInvalidationDiagnostics,
) {
  return function useGeneratedMutation() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (args: TArgs) => mutationFn(args).then(unwrapGeneratedMutationResult),
      onSuccess: async (data, args) => {
        // Generated mutation invalidation is strict: rejection keeps the mutation in an error state.
        // Callers that should stay successful must use log-only invalidation helpers inside this callback.
        try {
          await invalidate(qc, args, data);
        } catch (error) {
          if (invalidationDiagnostics !== undefined) {
            logRuntimeDiagnostic("mutation-invalidation", "[createMutation] invalidation failed:", {
              actionOwner: invalidationDiagnostics.actionOwner,
              queryKeys: invalidationDiagnostics.queryKeys,
              error,
            });
          }
          throw error;
        }
      },
    });
  };
}
