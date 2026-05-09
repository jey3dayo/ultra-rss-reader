import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_PANE_ACCOUNT_ID_ATTRIBUTE,
  focusAdjacentAccountPaneTarget,
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

  afterEach(() => {
    vi.restoreAllMocks();
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

  it("skips aria-disabled account pane navigation targets", () => {
    const selectedButton = createAccountPaneButton({ selected: true });
    const disabledButton = createAccountPaneButton({ ariaDisabled: true });
    const nextButton = createAccountPaneButton({});
    document.body.append(selectedButton, disabledButton, nextButton);

    expect(focusAdjacentAccountPaneTarget(1)).toBe(true);

    expect(nextButton).toHaveFocus();
  });

  it("keeps adjacent navigation successful when scrolling the next account target fails", () => {
    const selectedButton = createAccountPaneButton({ selected: true });
    const nextButton = createAccountPaneButton({});
    const scrollIntoView = vi.fn(() => {
      throw new Error("scroll failed");
    });
    Object.defineProperty(nextButton, "scrollIntoView", { value: scrollIntoView, configurable: true });
    document.body.append(selectedButton, nextButton);

    expect(focusAdjacentAccountPaneTarget(1)).toBe(true);

    expect(nextButton).toHaveFocus();
    expect(scrollIntoView).toHaveBeenCalledOnce();
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

function createAccountPaneButton(params: { selected?: boolean; ariaDisabled?: boolean }): HTMLButtonElement {
  const button = document.createElement("button");
  button.setAttribute("data-account-pane-navigation-target", "true");
  if (params.selected) {
    button.setAttribute(ACCOUNT_PANE_SELECTED_TARGET_ATTRIBUTE, "true");
  }
  if (params.ariaDisabled) {
    button.setAttribute("aria-disabled", "true");
  }
  return button;
}
