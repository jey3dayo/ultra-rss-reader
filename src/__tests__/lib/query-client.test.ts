import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { describe, expect, it } from "vitest";
import { queryClient } from "@/lib/query/query-client";

describe("query client retry policy", () => {
  it("keeps local IPC read queries non-retrying in production and tests", () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false);
    expect(createTestQueryClient().getDefaultOptions().queries?.retry).toBe(false);
  });

  it("allows tests to override query retry when a retry-specific scenario needs it", () => {
    expect(
      createTestQueryClient({
        defaultOptions: { queries: { retry: 2 } },
      }).getDefaultOptions().queries?.retry,
    ).toBe(2);
  });
});
