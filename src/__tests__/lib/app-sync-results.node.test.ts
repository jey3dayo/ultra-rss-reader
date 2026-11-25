import { describe, expect, it } from "vitest";
import type { AccountDto } from "@/api/tauri-commands";
import { extractSyncOnWakeAccountIds } from "@/lib/sync/app-sync-results";

function account(partial: Partial<AccountDto>): AccountDto {
  return {
    id: "acc-1",
    name: "FreshRSS",
    kind: "FreshRss",
    server_url: "https://example.com",
    username: "user",
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: true,
    sync_enabled: true,
    keep_read_items_days: 30,
    ...partial,
  };
}

describe("extractSyncOnWakeAccountIds", () => {
  it("excludes accounts whose sync is disabled even when sync on wake is on", () => {
    expect(
      extractSyncOnWakeAccountIds([
        account({ id: "enabled-wake" }),
        account({ id: "disabled-wake", sync_enabled: false }),
        account({ id: "enabled-no-wake", sync_on_wake: false }),
      ]),
    ).toEqual(["enabled-wake"]);
  });
});
