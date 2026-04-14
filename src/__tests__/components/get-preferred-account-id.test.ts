import { describe, expect, it } from "vitest";
import type { AccountDto } from "@/api/tauri-commands";
import { getPreferredAccountId } from "@/components/accounts/get-preferred-account-id";

const accounts: AccountDto[] = [
  {
    id: "acc-1",
    name: "Local",
    kind: "Local",
    server_url: null,
    username: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
  {
    id: "acc-2",
    name: "FreshRSS",
    kind: "FreshRss",
    server_url: "https://example.com",
    username: "user",
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: false,
    keep_read_items_days: 30,
  },
];

describe("getPreferredAccountId", () => {
  it("returns the saved account id when it exists", () => {
    expect(getPreferredAccountId(accounts, "acc-2")).toBe("acc-2");
  });

  it("falls back to the first account when the saved id is invalid", () => {
    expect(getPreferredAccountId(accounts, "missing")).toBe("acc-1");
  });

  it("returns null when there are no accounts", () => {
    expect(getPreferredAccountId([], "acc-2")).toBeNull();
  });
});
