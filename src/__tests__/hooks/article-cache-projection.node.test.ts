import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { isAccountKnownDeleted, shouldInvalidateAfterRecordArticleView } from "@/hooks/article-cache-projection";
import { queryKeys } from "@/lib/query/query-invalidation";

describe("article cache deletion projection", () => {
  it("does not treat an article missing from the recent cache as proof of deletion", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.accounts.root, [{ id: "account-1" }]);
    queryClient.setQueryData(queryKeys.recentArticles.byAccount("account-1", "all"), [{ id: "other-article" }]);

    expect(isAccountKnownDeleted(queryClient, "account-1")).toBe(false);
    expect(shouldInvalidateAfterRecordArticleView(queryClient, "account-1")).toBe(true);
  });

  it("only recognizes an account as deleted when the accounts cache proves it is absent", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.accounts.root, [{ id: "other-account" }]);

    expect(isAccountKnownDeleted(queryClient, "account-1")).toBe(true);
    expect(shouldInvalidateAfterRecordArticleView(queryClient, "account-1")).toBe(false);
  });

  it("fails open when the accounts cache cannot prove deletion", () => {
    const unsetQueryClient = new QueryClient();
    const malformedQueryClient = new QueryClient();
    malformedQueryClient.setQueryData(queryKeys.accounts.root, { id: "other-account" });

    for (const queryClient of [unsetQueryClient, malformedQueryClient]) {
      expect(isAccountKnownDeleted(queryClient, "account-1")).toBe(false);
      expect(shouldInvalidateAfterRecordArticleView(queryClient, "account-1")).toBe(true);
    }
  });
});
