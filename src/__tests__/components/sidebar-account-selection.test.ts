import { describe, expect, it } from "vitest";
import type { AccountDto } from "@/api/tauri-commands";
import { resolveSidebarAccountSelectionAction } from "@/components/reader/hooks/sidebar/use-sidebar-account-selection";
import { DEV_SCENARIO_ID } from "@/dev/scenario-ids";

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
  it("waits for preferences and accounts before restoring the startup selection", () => {
    expect(
      resolveSidebarAccountSelectionAction({
        accounts,
        preferencesLoaded: false,
        selectedAccountId: null,
        savedAccountId: "acc-2",
        layoutMode: "wide",
        activeDevIntent: null,
      }),
    ).toEqual({ type: "noop" });

    expect(
      resolveSidebarAccountSelectionAction({
        accounts: undefined,
        preferencesLoaded: true,
        selectedAccountId: null,
        savedAccountId: "acc-2",
        layoutMode: "wide",
        activeDevIntent: null,
      }),
    ).toEqual({ type: "noop" });
  });

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

  it("repairs stale or blank saved account preferences when restoring the reader account", () => {
    expect(
      resolveSidebarAccountSelectionAction({
        accounts,
        preferencesLoaded: true,
        selectedAccountId: null,
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

    expect(
      resolveSidebarAccountSelectionAction({
        accounts,
        preferencesLoaded: true,
        selectedAccountId: null,
        savedAccountId: "   ",
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

  it("normalizes whitespace-padded selected account ids before deciding restore or persist", () => {
    expect(
      resolveSidebarAccountSelectionAction({
        accounts,
        preferencesLoaded: true,
        selectedAccountId: " acc-1 ",
        savedAccountId: "acc-2",
        layoutMode: "wide",
        activeDevIntent: null,
      }),
    ).toEqual({ type: "noop" });

    expect(
      resolveSidebarAccountSelectionAction({
        accounts,
        preferencesLoaded: true,
        selectedAccountId: " acc-missing ",
        savedAccountId: "acc-2",
        layoutMode: "wide",
        activeDevIntent: null,
      }),
    ).toEqual({
      type: "restore",
      accountId: "acc-2",
      focusedPane: "list",
      persistPreference: false,
    });

    expect(
      resolveSidebarAccountSelectionAction({
        accounts,
        preferencesLoaded: true,
        selectedAccountId: " acc-missing ",
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

  it("treats whitespace-only selected account ids as missing and restores the saved account", () => {
    expect(
      resolveSidebarAccountSelectionAction({
        accounts,
        preferencesLoaded: true,
        selectedAccountId: "   ",
        savedAccountId: "acc-2",
        layoutMode: "wide",
        activeDevIntent: null,
      }),
    ).toEqual({
      type: "restore",
      accountId: "acc-2",
      focusedPane: "list",
      persistPreference: false,
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
