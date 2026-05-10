import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { describe, expect, it } from "vitest";
import {
  getQueryFailureUx,
  queryClient,
  queryClientDefaultOptions,
  queryClientLifecyclePolicy,
  READ_QUERY_RETRY_LIMIT,
  shouldRetryCommandSideEffect,
  shouldRetryReadQuery,
} from "@/lib/query/query-client";

describe("query client retry policy", () => {
  it("retries only retryable read query failures within the bounded default policy", () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(shouldRetryReadQuery);
    expect(queryClientDefaultOptions.queries.retry).toBe(shouldRetryReadQuery);
    expect(READ_QUERY_RETRY_LIMIT).toBe(2);
    expect(shouldRetryReadQuery(0, { type: "Retryable", message: "network timeout" })).toBe(true);
    expect(shouldRetryReadQuery(1, { type: "Retryable", message: "network timeout" })).toBe(true);
    expect(shouldRetryReadQuery(2, { type: "Retryable", message: "network timeout" })).toBe(false);
    expect(shouldRetryReadQuery(0, { type: "UserVisible", message: "Authentication failed" })).toBe(false);
    expect(shouldRetryReadQuery(0, { type: "UserVisible", message: "Permission denied" })).toBe(false);
    expect(shouldRetryReadQuery(0, { type: "Diagnostics", message: "Response validation failed" })).toBe(false);
    expect(shouldRetryReadQuery(0, { message: "Command validation failed" })).toBe(false);
    expect(createTestQueryClient().getDefaultOptions().queries?.retry).toBe(false);
  });

  it("keeps command side effects non-retrying by default", () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(shouldRetryCommandSideEffect);
    expect(queryClientDefaultOptions.mutations.retry).toBe(shouldRetryCommandSideEffect);
    expect(shouldRetryCommandSideEffect()).toBe(false);
    expect(createTestQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });

  it("keeps the desktop app query lifecycle policy explicit", () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(0);
    expect(queryClient.getDefaultOptions().queries?.gcTime).toBe(5 * 60 * 1000);
    expect(queryClient.getDefaultOptions().queries?.refetchOnWindowFocus).toBe(false);
    expect(queryClientDefaultOptions.queries).toMatchObject({
      staleTime: 0,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    });
  });

  it("keeps app-wide singleton reset policy explicit", () => {
    expect(queryClientLifecyclePolicy).toEqual({
      instance: "app-wide-singleton",
      reset: "manual-clear-after-database-restore",
      remount: "reuse-existing-client",
    });
  });

  it("allows tests to override query retry when a retry-specific scenario needs it", () => {
    expect(
      createTestQueryClient({
        defaultOptions: { queries: { retry: 2 } },
      }).getDefaultOptions().queries?.retry,
    ).toBe(2);
  });

  it("allows tests to override mutation retry when a retry-specific scenario needs it", () => {
    expect(
      createTestQueryClient({
        defaultOptions: { mutations: { retry: 2 } },
      }).getDefaultOptions().mutations?.retry,
    ).toBe(2);
  });

  it("classifies transient command failures for manual retry UX without enabling global query retries", () => {
    expect(getQueryFailureUx({ type: "Retryable", message: "network timeout" })).toEqual({
      retry: false,
      transientFailure: "manual-retry",
    });
    expect(
      getQueryFailureUx({
        type: "UserVisible",
        message: "Database is busy. Wait for the current operation to finish and try again.",
      }),
    ).toEqual({
      retry: false,
      transientFailure: "manual-retry",
    });
    expect(
      getQueryFailureUx({
        type: "Diagnostics",
        message: "Response validation failed.",
      }),
    ).toEqual({
      retry: false,
      transientFailure: "diagnostics",
    });
    expect(getQueryFailureUx({ type: "UserVisible", message: "Feed not found" })).toEqual({
      retry: false,
      transientFailure: "none",
    });
  });
});
