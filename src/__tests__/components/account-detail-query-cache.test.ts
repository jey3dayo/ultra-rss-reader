import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import type { AccountDto } from "@/api/tauri-commands";
import { updateCachedAccount, upsertCachedAccount } from "@/components/settings/account-detail-query-cache";

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
    const queryClient = new QueryClient();
    const updated = buildAccount("acc-1", "Updated");
    queryClient.setQueryData(["accounts"], [buildAccount("acc-1"), buildAccount("acc-2")]);

    updateCachedAccount(queryClient, updated);

    expect(queryClient.getQueryData(["accounts"])).toEqual([updated, buildAccount("acc-2")]);
  });

  it("keeps an empty account cache empty when updating", () => {
    const queryClient = new QueryClient();

    updateCachedAccount(queryClient, buildAccount("acc-1"));

    expect(queryClient.getQueryData(["accounts"])).toBeUndefined();
  });

  it("upserts into an empty account cache", () => {
    const queryClient = new QueryClient();
    const account = buildAccount("acc-1");

    upsertCachedAccount(queryClient, account);

    expect(queryClient.getQueryData(["accounts"])).toEqual([account]);
  });

  it("appends accounts that are not already cached", () => {
    const queryClient = new QueryClient();
    const first = buildAccount("acc-1");
    const second = buildAccount("acc-2");
    queryClient.setQueryData(["accounts"], [first]);

    upsertCachedAccount(queryClient, second);

    expect(queryClient.getQueryData(["accounts"])).toEqual([first, second]);
  });
});
