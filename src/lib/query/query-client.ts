import type { DefaultOptions } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import type { AppError } from "@/api/schemas/error";
import { classifyQueryTransientFailureUx } from "@/lib/ui-errors";

export const READ_QUERY_RETRY_LIMIT = 2;

function isAppError(error: unknown): error is AppError {
  return (
    error !== null &&
    typeof error === "object" &&
    "type" in error &&
    "message" in error &&
    typeof error.message === "string" &&
    (error.type === "UserVisible" || error.type === "Retryable" || error.type === "Diagnostics")
  );
}

export function shouldRetryReadQuery(failureCount: number, error: unknown): boolean {
  return isAppError(error) && error.type === "Retryable" && failureCount < READ_QUERY_RETRY_LIMIT;
}

export function shouldRetryCommandSideEffect(): false {
  return false;
}

export function getQueryFailureUx(error: AppError) {
  return {
    retry: false,
    transientFailure: classifyQueryTransientFailureUx(error),
  } as const;
}

export const queryClientDefaultOptions = {
  queries: {
    retry: shouldRetryReadQuery,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: shouldRetryCommandSideEffect,
  },
} as const satisfies DefaultOptions;

export const queryClientLifecyclePolicy = {
  instance: "app-wide-singleton",
  cachePersistence: "disabled",
  bootCache: "empty-after-reload",
  startupRefetch: "observer-driven",
  reset: "manual-clear-after-database-restore",
  remount: "reuse-existing-client",
} as const;

export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: queryClientDefaultOptions,
  });
}

export const queryClient = createAppQueryClient();
