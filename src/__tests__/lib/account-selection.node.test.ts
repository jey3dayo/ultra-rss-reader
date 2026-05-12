import { describe, expect, it } from "vitest";
import type { AccountDto } from "@/api/tauri-commands";
import { getPreferredAccountId, resolveRestoredAccountSelection } from "@/lib/account/account-selection";

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

  it("trims the saved account id before matching", () => {
    expect(getPreferredAccountId(accounts, " acc-2 ")).toBe("acc-2");
  });

  it("falls back to the first account when the saved id is invalid", () => {
    expect(getPreferredAccountId(accounts, "missing")).toBe("acc-1");
  });

  it("falls back to the first account when the saved id is whitespace-only", () => {
    expect(getPreferredAccountId(accounts, "   ")).toBe("acc-1");
  });

  it("returns the normalized saved account id when matching duplicate account ids", () => {
    expect(getPreferredAccountId([...accounts, { ...accounts[1], name: "FreshRSS duplicate" }], " acc-2 ")).toBe(
      "acc-2",
    );
  });

  it("returns null when there are no accounts", () => {
    expect(getPreferredAccountId([], "acc-2")).toBeNull();
  });
});

describe("resolveRestoredAccountSelection", () => {
  it("keeps a selected account that still exists after DB restore and repairs a stale saved preference", () => {
    expect(
      resolveRestoredAccountSelection({
        accounts,
        selectedAccountId: " acc-2 ",
        savedAccountId: "missing",
      }),
    ).toEqual({
      accountId: "acc-2",
      preferenceAccountId: "acc-2",
    });
  });

  it("restores the saved account when the selected account no longer exists after DB restore", () => {
    expect(
      resolveRestoredAccountSelection({
        accounts,
        selectedAccountId: "deleted-account",
        savedAccountId: "acc-2",
      }),
    ).toEqual({
      accountId: "acc-2",
      preferenceAccountId: "acc-2",
    });
  });

  it("falls back to the first restored account and persists it when both selected and saved accounts are stale", () => {
    expect(
      resolveRestoredAccountSelection({
        accounts,
        selectedAccountId: "deleted-account",
        savedAccountId: "also-deleted",
      }),
    ).toEqual({
      accountId: "acc-1",
      preferenceAccountId: "acc-1",
    });
  });

  it("clears selection and saved preference when restore leaves no accounts", () => {
    expect(
      resolveRestoredAccountSelection({
        accounts: [],
        selectedAccountId: "deleted-account",
        savedAccountId: "also-deleted",
      }),
    ).toEqual({
      accountId: null,
      preferenceAccountId: "",
    });
  });
});
