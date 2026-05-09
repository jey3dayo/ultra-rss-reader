import { beforeEach, describe, expect, it } from "vitest";
import {
  ACCOUNT_PANE_ACCOUNT_ID_ATTRIBUTE,
  normalizePaneNavigationKey,
  selectCurrentAccountPaneTargetAndFocusSidebar,
} from "@/lib/account/account-pane-navigation";
import { ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE } from "@/lib/reader-focus";
import { useUiStore } from "@/stores/ui-store";

describe("account-pane-navigation", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    useUiStore.setState(useUiStore.getInitialState());
  });

  it("normalizes legacy and standard pane navigation keys", () => {
    expect(normalizePaneNavigationKey("ArrowDown")).toBe("ArrowDown");
    expect(normalizePaneNavigationKey("Down")).toBe("ArrowDown");
    expect(normalizePaneNavigationKey("ArrowUp")).toBe("ArrowUp");
    expect(normalizePaneNavigationKey("Up")).toBe("ArrowUp");
    expect(normalizePaneNavigationKey("ArrowRight")).toBe("ArrowRight");
    expect(normalizePaneNavigationKey("Right")).toBe("ArrowRight");
    expect(normalizePaneNavigationKey("Escape")).toBe("Escape");
    expect(normalizePaneNavigationKey("Enter")).toBe("Enter");
  });

  it("ignores keys that do not navigate panes", () => {
    expect(normalizePaneNavigationKey("ArrowLeft")).toBeNull();
    expect(normalizePaneNavigationKey("Tab")).toBeNull();
    expect(normalizePaneNavigationKey("")).toBeNull();
  });

  it("rejects blank account pane account ids before selecting an account", () => {
    const button = document.createElement("button");
    button.setAttribute("data-account-pane-navigation-target", "true");
    button.setAttribute(ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE, "true");
    button.setAttribute(ACCOUNT_PANE_ACCOUNT_ID_ATTRIBUTE, "   ");
    document.body.append(button);

    expect(selectCurrentAccountPaneTargetAndFocusSidebar()).toBe(false);
    expect(useUiStore.getState().selectedAccountId).toBeNull();
  });

  it("trims account pane account ids before selecting an account", () => {
    const button = document.createElement("button");
    button.setAttribute("data-account-pane-navigation-target", "true");
    button.setAttribute(ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE, "true");
    button.setAttribute(ACCOUNT_PANE_ACCOUNT_ID_ATTRIBUTE, " acc-1 ");
    document.body.append(button);

    expect(selectCurrentAccountPaneTargetAndFocusSidebar()).toBe(true);
    expect(useUiStore.getState().selectedAccountId).toBe("acc-1");
    expect(useUiStore.getState().focusedPane).toBe("sidebar");
  });
});
