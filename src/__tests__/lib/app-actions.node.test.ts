import { describe, expect, it } from "vitest";
import {
  type AppAction,
  type AppActionAvailabilityContext,
  articleScopedActions,
  getAppActionUnavailableReason,
  isAppActionAvailable,
} from "@/lib/app-actions";

const baseContext: AppActionAvailabilityContext = {
  selectedAccountId: "account-1",
  selectedArticleId: "article-1",
  contentMode: "reader",
  commandPaletteOpen: false,
  settingsOpen: false,
  confirmDialogOpen: false,
  shortcutsHelpOpen: false,
  isAddFeedDialogOpen: false,
};

const modalStates = [
  ["settings dialog", { settingsOpen: true }],
  ["confirm dialog", { confirmDialogOpen: true }],
  ["shortcuts help dialog", { shortcutsHelpOpen: true }],
  ["command palette", { commandPaletteOpen: true }],
  ["add feed dialog", { isAddFeedDialogOpen: true }],
] as const satisfies readonly (readonly [string, Partial<AppActionAvailabilityContext>])[];

const modalAllowedNativeMenuActions = [
  "check-for-updates",
  "sync-all",
  "toggle-fullscreen",
  "toggle-sort-unread",
  "toggle-group-by-feed",
] as const satisfies readonly AppAction[];

describe("native menu action availability", () => {
  it.each(articleScopedActions)("reports %s as requiring an article when none is selected", (action) => {
    expect(getAppActionUnavailableReason(action, "nativeMenu", { ...baseContext, selectedArticleId: null })).toBe(
      "requires-article",
    );
    expect(getAppActionUnavailableReason(action, "nativeMenu", baseContext)).toBeNull();
  });

  describe.each(modalStates)("while the %s is open", (_label, modalState) => {
    const context = { ...baseContext, ...modalState };

    it.each(["set-filter-unread", "toggle-star", "open-settings"] as const)("blocks %s as modal-open", (action) => {
      expect(getAppActionUnavailableReason(action, "nativeMenu", context)).toBe("modal-open");
    });

    it.each(modalAllowedNativeMenuActions)("lets %s through", (action) => {
      expect(getAppActionUnavailableReason(action, "nativeMenu", context)).not.toBe("modal-open");
    });
  });

  it("reports modal-open before a missing article", () => {
    expect(
      getAppActionUnavailableReason("toggle-star", "nativeMenu", {
        ...baseContext,
        selectedArticleId: null,
        isAddFeedDialogOpen: true,
      }),
    ).toBe("modal-open");
  });
});

describe("command palette action availability", () => {
  it("ignores an open confirm dialog", () => {
    expect(isAppActionAvailable("toggle-star", "commandPalette", { ...baseContext, confirmDialogOpen: true })).toBe(
      true,
    );
  });

  it("keeps blocking on the dialogs it already tracked", () => {
    expect(isAppActionAvailable("toggle-star", "commandPalette", { ...baseContext, isAddFeedDialogOpen: true })).toBe(
      false,
    );
    expect(isAppActionAvailable("toggle-star", "commandPalette", { ...baseContext, settingsOpen: true })).toBe(false);
    expect(isAppActionAvailable("toggle-star", "commandPalette", { ...baseContext, commandPaletteOpen: true })).toBe(
      true,
    );
  });
});
