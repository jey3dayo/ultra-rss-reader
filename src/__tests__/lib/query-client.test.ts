import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { describe, expect, it } from "vitest";
import { getQueryFailureUx, queryClient, queryClientDefaultOptions } from "@/lib/query/query-client";

describe("query client retry policy", () => {
  it("keeps local IPC read queries non-retrying in production and tests", () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false);
    expect(queryClientDefaultOptions.queries.retry).toBe(false);
    expect(createTestQueryClient().getDefaultOptions().queries?.retry).toBe(false);
  });

  it("keeps test mutations non-retrying by default", () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false);
    expect(queryClientDefaultOptions.mutations.retry).toBe(false);
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
    expect(getQueryFailureUx({ type: "Diagnostics", message: "Response validation failed." })).toEqual({
      retry: false,
      transientFailure: "diagnostics",
    });
    expect(getQueryFailureUx({ type: "UserVisible", message: "Feed not found" })).toEqual({
      retry: false,
      transientFailure: "none",
    });
  });
});
