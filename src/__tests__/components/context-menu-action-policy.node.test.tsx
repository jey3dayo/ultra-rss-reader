import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTEXT_MENU_ACTION_IDS,
  createMenuActionHandler,
  formatMenuActionDebugTrace,
} from "@/components/reader/context-menu-action-policy";
import { APP_EVENTS } from "@/constants/events";

const ACTION_ID_PATTERN = /^[a-z]+(?:-[a-z0-9]+)*$/;

setupBrowserTestDom();

describe("context menu action policy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps every context menu action id as stable kebab-case data", () => {
    const actionIds = Object.values(CONTEXT_MENU_ACTION_IDS);

    expect(new Set(actionIds).size).toBe(actionIds.length);
    expect(actionIds).toContain("feed-mark-old-unread-read-days");
    expect(actionIds).toContain("folder-mark-old-unread-read-days");
    expect(actionIds).toContain("tag-delete");
    expect(actionIds.every((actionId) => ACTION_ID_PATTERN.test(actionId))).toBe(true);
  });

  it("formats debug traces with the same data-action-id label used by menu items", () => {
    expect(formatMenuActionDebugTrace(CONTEXT_MENU_ACTION_IDS.feedSetDisplayPreset)).toBe(
      "menu-action feed-set-display-preset",
    );
    expect(formatMenuActionDebugTrace(CONTEXT_MENU_ACTION_IDS.feedSetDisplayPreset, "preview")).toBe(
      "menu-action feed-set-display-preset value=preview",
    );
  });

  it("routes async Base UI action rejections through debug trace, diagnostics, and toast once", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const listener = vi.fn();
    const showToast = vi.fn();
    const action = vi.fn().mockRejectedValue(new Error("Native action failed"));

    window.addEventListener(APP_EVENTS.debugInputTrace, listener);
    createMenuActionHandler(CONTEXT_MENU_ACTION_IDS.feedOpenSite, action, { showToast })();
    createMenuActionHandler(CONTEXT_MENU_ACTION_IDS.feedOpenSite, action, { showToast })();

    await vi.waitFor(() => {
      expect(showToast).toHaveBeenCalledTimes(2);
    });
    window.removeEventListener(APP_EVENTS.debugInputTrace, listener);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(String(listener.mock.calls[0]?.[0].detail)).toMatch(/ menu-action feed-open-site$/);
    expect(showToast).toHaveBeenNthCalledWith(1, "Native action failed");
    expect(showToast).toHaveBeenNthCalledWith(2, "Native action failed");
    expect(consoleError.mock.calls.filter((call) => call[0] === "Menu action failed: feed-open-site")).toHaveLength(1);
  });
});
