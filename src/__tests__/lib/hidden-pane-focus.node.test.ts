import "@testing-library/jest-dom/vitest";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disableHiddenPaneFocus,
  HIDDEN_PANE_PREVIOUS_TAB_INDEX_ATTRIBUTE,
  restoreHiddenPaneFocus,
} from "@/lib/dom/hidden-pane-focus";

setupBrowserTestDom();

describe("hidden pane focus", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("disables focusable descendants and restores their previous tab order", () => {
    const root = document.createElement("section");
    const defaultButton = document.createElement("button");
    const customButton = document.createElement("button");
    customButton.setAttribute("tabindex", "3");
    root.append(defaultButton, customButton);
    document.body.append(root);

    disableHiddenPaneFocus(root);

    expect(defaultButton).toHaveAttribute("tabindex", "-1");
    expect(defaultButton).toHaveAttribute(HIDDEN_PANE_PREVIOUS_TAB_INDEX_ATTRIBUTE, "");
    expect(customButton).toHaveAttribute("tabindex", "-1");
    expect(customButton).toHaveAttribute(HIDDEN_PANE_PREVIOUS_TAB_INDEX_ATTRIBUTE, "3");

    restoreHiddenPaneFocus(root);

    expect(defaultButton).not.toHaveAttribute("tabindex");
    expect(defaultButton).not.toHaveAttribute(HIDDEN_PANE_PREVIOUS_TAB_INDEX_ATTRIBUTE);
    expect(customButton).toHaveAttribute("tabindex", "3");
    expect(customButton).not.toHaveAttribute(HIDDEN_PANE_PREVIOUS_TAB_INDEX_ATTRIBUTE);
  });

  it("blurs active descendants when hiding the pane", () => {
    const root = document.createElement("section");
    const button = document.createElement("button");
    root.append(button);
    document.body.append(root);
    button.focus();
    const blurSpy = vi.spyOn(button, "blur");

    disableHiddenPaneFocus(root);

    expect(blurSpy).toHaveBeenCalledTimes(1);
  });
});
