import { describe, expect, it } from "vitest";
import type { AccountDto } from "@/api/tauri-commands";
import { resolveSidebarAccountSelectionAction } from "@/components/reader/use-sidebar-account-selection";
import { DEV_SCENARIO_ID } from "@/lib/dev-scenario-ids";

const accounts: AccountDto[] = [
  {
    id: "acc-1",
    kind: "fresh_rss",
    name: "Account 1",
    server_url: null,
    username: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: true,
    keep_read_items_days: 30,
  },
  {
    id: "acc-2",
    kind: "fresh_rss",
    name: "Account 2",
    server_url: null,
    username: null,
    sync_interval_secs: 3600,
    sync_on_startup: true,
    sync_on_wake: true,
    keep_read_items_days: 30,
  },
];

describe("resolveSidebarAccountSelectionAction", () => {
  it("clears selection and saved preference when no accounts remain", () => {
    expect(
      resolveSidebarAccountSelectionAction({
        accounts: [],
        preferencesLoaded: true,
        selectedAccountId: "acc-missing",
        savedAccountId: "acc-2",
        layoutMode: "wide",
        activeDevIntent: null,
      }),
    ).toEqual({
      type: "clear",
      clearSavedPreference: true,
    });
  });

  it("keeps the saved account focused in the sidebar on mobile restores", () => {
    expect(
      resolveSidebarAccountSelectionAction({
        accounts,
        preferencesLoaded: true,
        selectedAccountId: null,
        savedAccountId: "acc-2",
        layoutMode: "mobile",
        activeDevIntent: null,
      }),
    ).toEqual({
      type: "restore",
      accountId: "acc-2",
      focusedPane: "sidebar",
      persistPreference: false,
    });
  });

  it("falls back to the first account and persists it when the saved one is invalid", () => {
    expect(
      resolveSidebarAccountSelectionAction({
        accounts,
        preferencesLoaded: true,
        selectedAccountId: "acc-missing",
        savedAccountId: "acc-unknown",
        layoutMode: "wide",
        activeDevIntent: null,
      }),
    ).toEqual({
      type: "restore",
      accountId: "acc-1",
      focusedPane: "list",
      persistPreference: true,
    });
  });

  it("does nothing while the dev intent forces the web preview flow", () => {
    expect(
      resolveSidebarAccountSelectionAction({
        accounts,
        preferencesLoaded: true,
        selectedAccountId: null,
        savedAccountId: "acc-2",
        layoutMode: "wide",
        activeDevIntent: DEV_SCENARIO_ID.openWebPreviewUrl,
      }),
    ).toEqual({ type: "noop" });
  });
});
