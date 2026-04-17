import { describe, expect, it } from "vitest";
import { DEV_SCENARIO_ID } from "@/lib/dev-scenario-ids";
import { resolveSidebarAccountSelectionAction } from "@/components/reader/use-sidebar-account-selection";

const accounts = [
  { id: "acc-1" },
  { id: "acc-2" },
] as const;

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
