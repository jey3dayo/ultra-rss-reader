import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";

export type CreateQueryDiagnostic =
  | {
      type: "disabled-query-refetch";
      queryKey: string;
    }
  | {
      type: "query-function-rejected";
      queryKey: string;
      queryId: string;
      error: unknown;
    };

let createQueryDiagnosticsReporter: (diagnostic: CreateQueryDiagnostic) => void = reportCreateQueryDiagnostic;

function reportCreateQueryDiagnostic(diagnostic: CreateQueryDiagnostic) {
  if (diagnostic.type === "disabled-query-refetch") {
    console.warn("[createQuery] queryFn called while generated query is disabled:", { queryKey: diagnostic.queryKey });
    return;
  }

  console.warn("[createQuery] generated queryFn rejected:", {
    queryKey: diagnostic.queryKey,
    queryId: diagnostic.queryId,
    error: diagnostic.error,
  });
}

export function setCreateQueryDiagnosticsReporterForDiagnostics(reporter: (diagnostic: CreateQueryDiagnostic) => void) {
  createQueryDiagnosticsReporter = reporter;
  return () => {
    createQueryDiagnosticsReporter = reportCreateQueryDiagnostic;
  };
}

function normalizeQueryId(id: string | null): string | null {
  const normalizedId = id?.trim() ?? "";
  if (normalizedId.length === 0) {
    return null;
  }

  return normalizedId;
}

function unwrapGeneratedQueryResult<TData>(
  result: Result.Result<TData, { message: string }>,
  queryKey: string,
  queryId: string,
): TData {
  if (Result.isFailure(result)) {
    throw new Error(`[${queryKey}:${queryId}] ${result.error.message}`);
  }

  return result.value;
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
          createQueryDiagnosticsReporter({ type: "disabled-query-refetch", queryKey });
          return Promise.reject(new Error("Query id is required when the query is enabled."));
        }

        return fetcher(queryId)
          .then((result) => unwrapGeneratedQueryResult(result, queryKey, queryId))
          .catch((error: unknown) => {
            createQueryDiagnosticsReporter({ type: "query-function-rejected", queryKey, queryId, error });
            throw error;
          });
      },
      enabled: queryId !== null,
      retry: false,
    });
  };
}
