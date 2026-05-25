import { Result } from "@praha/byethrow";
import { useQuery } from "@tanstack/react-query";
import type { AppError } from "@/api/schemas/error";
import { shouldRetryReadQuery } from "@/lib/query/query-client";
import { normalizeQueryAccountId } from "@/lib/query/query-invalidation";

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
    queryId: redactDiagnosticQueryId(diagnostic.queryId),
    error: redactDiagnosticError(diagnostic.error, diagnostic.queryKey, diagnostic.queryId),
  });
}

export function setCreateQueryDiagnosticsReporterForDiagnostics(reporter: (diagnostic: CreateQueryDiagnostic) => void) {
  createQueryDiagnosticsReporter = reporter;
  return () => {
    resetCreateQueryDiagnosticsReporterForTests();
  };
}

export function resetCreateQueryDiagnosticsReporterForTests(): void {
  createQueryDiagnosticsReporter = reportCreateQueryDiagnostic;
}

function normalizeQueryId(id: string | null): string | null {
  return normalizeQueryAccountId(id);
}

function redactDiagnosticQueryId(queryId: string): string {
  return queryId.length > 0 ? "<redacted>" : queryId;
}

function redactDiagnosticError(error: unknown, queryKey: string, queryId: string): unknown {
  const redactedMessagePattern = `[${queryKey}:${queryId}]`;
  const redactedMessageReplacement = `[${queryKey}:<redacted>]`;

  if (!(error instanceof Error)) {
    if (error !== null && typeof error === "object" && "message" in error && typeof error.message === "string") {
      return {
        ...error,
        message: error.message.replace(redactedMessagePattern, redactedMessageReplacement),
      };
    }

    return error;
  }

  const redactedMessage = error.message.replace(redactedMessagePattern, redactedMessageReplacement);
  if (redactedMessage === error.message) {
    return error;
  }

  const redactedError =
    "cause" in error ? new Error(redactedMessage, { cause: error.cause }) : new Error(redactedMessage);
  redactedError.name = error.name;
  return redactedError;
}

type GeneratedQueryError = Pick<AppError, "message"> & Partial<Pick<AppError, "type">>;

export function unwrapReadQueryResult<TData>(result: Result.Result<TData, GeneratedQueryError>): TData {
  return Result.unwrap(result);
}

function unwrapGeneratedQueryResult<TData>(
  result: Result.Result<TData, GeneratedQueryError>,
  queryKey: string,
  queryId: string,
): TData {
  if (Result.isFailure(result)) {
    throw {
      ...result.error,
      message: `[${queryKey}:${queryId}] ${result.error.message}`,
    };
  }

  return result.value;
}

export function createQuery<TData, TId extends string | null>(
  queryRoot: string | readonly unknown[],
  fetcher: (id: string) => Result.ResultAsync<TData, GeneratedQueryError>,
) {
  const queryKeyLabel = typeof queryRoot === "string" ? queryRoot : String(queryRoot[queryRoot.length - 1] ?? "");
  const queryKeyRoot = typeof queryRoot === "string" ? [queryRoot] : queryRoot;

  return function useGeneratedQuery(id: TId) {
    const queryId = normalizeQueryId(id);
    return useQuery<TData, GeneratedQueryError | Error, TData, readonly unknown[]>({
      queryKey: [...queryKeyRoot, queryId],
      queryFn: () => {
        if (queryId === null) {
          createQueryDiagnosticsReporter({
            type: "disabled-query-refetch",
            queryKey: queryKeyLabel,
          });
          return Promise.reject(new Error("Query id is required when the query is enabled."));
        }

        return fetcher(queryId)
          .then((result) => unwrapGeneratedQueryResult(result, queryKeyLabel, queryId))
          .catch((error: unknown) => {
            createQueryDiagnosticsReporter({
              type: "query-function-rejected",
              queryKey: queryKeyLabel,
              queryId,
              error,
            });
            throw error;
          });
      },
      enabled: queryId !== null,
      retry: shouldRetryReadQuery,
    });
  };
}
