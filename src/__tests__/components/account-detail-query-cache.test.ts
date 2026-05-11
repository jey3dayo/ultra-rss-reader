import { createTestQueryClient } from "@tests/helpers/create-wrapper";
import { describe, expect, it } from "vitest";
import type { AccountDto } from "@/api/tauri-commands";
import {
  patchCachedAccount,
  removeCachedAccount,
  updateCachedAccount,
  upsertCachedAccount,
} from "@/components/settings/account-detail/query-cache";
import { queryKeys } from "@/lib/query/query-invalidation";

function buildAccount(id: string, name = id): AccountDto {
  return {
    id,
    kind: "local",
    name,
    server_url: null,
    username: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  };
}

describe("account-detail-query-cache", () => {
  it("updates an existing cached account", () => {
    const queryClient = createTestQueryClient();
    const updated = buildAccount("acc-1", "Updated");
    queryClient.setQueryData(queryKeys.accounts.root, [buildAccount("acc-1"), buildAccount("acc-2")]);

    updateCachedAccount(queryClient, updated);

    expect(queryClient.getQueryData(queryKeys.accounts.root)).toEqual([updated, buildAccount("acc-2")]);
  });

  it("keeps server refetch patches scoped to cached accounts", () => {
    const queryClient = createTestQueryClient();
    const first = buildAccount("acc-1");
    const missing = buildAccount("acc-2", "Server Refetch");
    queryClient.setQueryData(queryKeys.accounts.root, [first]);

    patchCachedAccount(queryClient, missing, { owner: "server-refetch" });

    expect(queryClient.getQueryData(queryKeys.accounts.root)).toEqual([first]);
  });

  it("keeps an empty account cache empty when updating", () => {
    const queryClient = createTestQueryClient();

    updateCachedAccount(queryClient, buildAccount("acc-1"));

    expect(queryClient.getQueryData(queryKeys.accounts.root)).toBeUndefined();
  });

  it("upserts into an empty account cache", () => {
    const queryClient = createTestQueryClient();
    const account = buildAccount("acc-1");

    upsertCachedAccount(queryClient, account);

    expect(queryClient.getQueryData(queryKeys.accounts.root)).toEqual([account]);
  });

  it("uses optimistic update patches to create a missing account cache", () => {
    const queryClient = createTestQueryClient();
    const account = buildAccount("acc-1");

    patchCachedAccount(queryClient, account, { owner: "optimistic-update" });

    expect(queryClient.getQueryData(queryKeys.accounts.root)).toEqual([account]);
  });

  it("appends accounts that are not already cached", () => {
    const queryClient = createTestQueryClient();
    const first = buildAccount("acc-1");
    const second = buildAccount("acc-2");
    queryClient.setQueryData(queryKeys.accounts.root, [first]);

    upsertCachedAccount(queryClient, second);

    expect(queryClient.getQueryData(queryKeys.accounts.root)).toEqual([first, second]);
  });

  it("removes deleted accounts from the cache", () => {
    const queryClient = createTestQueryClient();
    const first = buildAccount("acc-1");
    const second = buildAccount("acc-2");
    queryClient.setQueryData(queryKeys.accounts.root, [first, second]);

    removeCachedAccount(queryClient, first.id);

    expect(queryClient.getQueryData(queryKeys.accounts.root)).toEqual([second]);
  });
});
