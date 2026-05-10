import type { DefaultOptions } from "@tanstack/react-query";
import { QueryClient } from "@tanstack/react-query";
import type { AppError } from "@/api/schemas/error";
import { classifyQueryTransientFailureUx } from "@/lib/ui-errors";

export function getQueryFailureUx(error: AppError) {
  return {
    retry: false,
    transientFailure: classifyQueryTransientFailureUx(error),
  } as const;
}

export const queryClientDefaultOptions = {
  queries: {
    retry: false,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: false,
  },
} as const satisfies DefaultOptions;

export const queryClientLifecyclePolicy = {
  instance: "app-wide-singleton",
  reset: "manual-clear-after-database-restore",
  remount: "reuse-existing-client",
} as const;

export const queryClient = new QueryClient({
  defaultOptions: queryClientDefaultOptions,
});
