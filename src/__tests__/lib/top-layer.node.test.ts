import "@testing-library/jest-dom/vitest";
import { setupBrowserTestDom } from "@tests/helpers/browser-test-globals";
import { afterEach, describe, expect, it } from "vitest";
import {
  hasOpenDialogTopLayer,
  hasOpenNestedEscapeLayer,
  hideElementsOutsideDialog,
  topLayerOwnsFocus,
} from "@/lib/dom/top-layer";

setupBrowserTestDom();

describe("top-layer DOM helpers", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("detects open dialog top layers", () => {
    const closedDialog = document.createElement("div");
    closedDialog.dataset.slot = "dialog-content";
    document.body.append(closedDialog);

    expect(hasOpenDialogTopLayer()).toBe(false);

    closedDialog.dataset.open = "";

    expect(hasOpenDialogTopLayer()).toBe(true);
    expect(hasOpenDialogTopLayer(null)).toBe(false);
  });

  it("detects nested Escape-owning layers inside a provided root", () => {
    const root = document.createElement("section");
    const popperWrapper = document.createElement("div");
    popperWrapper.dataset.radixPopperContentWrapper = "";
    root.append(popperWrapper);

    expect(hasOpenNestedEscapeLayer(root)).toBe(true);
    expect(hasOpenNestedEscapeLayer(document.body)).toBe(false);
    expect(hasOpenNestedEscapeLayer(null)).toBe(false);
  });

  it("detects when an open top layer owns focus", () => {
    const dialog = document.createElement("div");
    dialog.dataset.stackLayer = "dialog";
    const button = document.createElement("button");
    dialog.append(button);
    document.body.append(dialog);

    button.focus();

    expect(topLayerOwnsFocus()).toBe(true);
  });

  it("does not treat hidden or inert top layers as focus owners", () => {
    const dialog = document.createElement("div");
    dialog.dataset.stackLayer = "dialog";
    dialog.setAttribute("aria-hidden", "true");
    const button = document.createElement("button");
    dialog.append(button);
    document.body.append(dialog);

    button.focus();
    expect(topLayerOwnsFocus()).toBe(false);

    dialog.removeAttribute("aria-hidden");
    dialog.setAttribute("inert", "");

    expect(topLayerOwnsFocus()).toBe(false);
  });

  it("ignores body focus and missing documents", () => {
    document.body.focus();

    expect(topLayerOwnsFocus()).toBe(false);
    expect(topLayerOwnsFocus(null)).toBe(false);
  });

  it("hides and restores body children outside the active dialog stack", () => {
    const background = document.createElement("main");
    background.setAttribute("aria-hidden", "false");
    const agentationRoot = document.createElement("div");
    agentationRoot.dataset.agentationRoot = "";
    const dialogOverlay = document.createElement("div");
    dialogOverlay.dataset.dialogStackId = "dialog-1";
    const dialogContent = document.createElement("div");
    dialogContent.dataset.dialogStackId = "dialog-1";
    dialogContent.dataset.slot = "dialog-content";
    document.body.append(background, agentationRoot, dialogOverlay, dialogContent);

    const restore = hideElementsOutsideDialog("dialog-1");

    expect(background).toHaveAttribute("aria-hidden", "true");
    expect(background).toHaveAttribute("inert");
    expect(agentationRoot).not.toHaveAttribute("aria-hidden");
    expect(agentationRoot).not.toHaveAttribute("inert");
    expect(dialogOverlay).not.toHaveAttribute("aria-hidden");
    expect(dialogContent).not.toHaveAttribute("aria-hidden");

    restore();

    expect(background).toHaveAttribute("aria-hidden", "false");
    expect(background).not.toHaveAttribute("inert");
  });

  it("keeps the app interactive when stacked dialog hides release in mount order", () => {
    // Regression: feed edit dialog + unsubscribe confirm both hide the app
    // root; when both close in one commit, cleanups run in mount order and the
    // later dialog must not restore the inert state the earlier dialog applied.
    const appRoot = document.createElement("main");
    const editOverlay = document.createElement("div");
    editOverlay.dataset.dialogStackId = "dialog-edit";
    const editContent = document.createElement("div");
    editContent.dataset.dialogStackId = "dialog-edit";
    editContent.dataset.slot = "dialog-content";
    editContent.dataset.open = "";
    const confirmContent = document.createElement("div");
    confirmContent.dataset.dialogStackId = "dialog-confirm";
    confirmContent.dataset.slot = "dialog-content";
    confirmContent.dataset.open = "";
    document.body.append(appRoot, editOverlay, editContent, confirmContent);

    const restoreEdit = hideElementsOutsideDialog("dialog-edit");
    const restoreConfirm = hideElementsOutsideDialog("dialog-confirm");

    expect(appRoot).toHaveAttribute("inert");

    restoreEdit();
    restoreConfirm();

    expect(appRoot).not.toHaveAttribute("inert");
    expect(appRoot).not.toHaveAttribute("aria-hidden");
    expect(appRoot.inert).toBeFalsy();
  });

  it("does not hide ancestors that contain dialog stack elements", () => {
    const portalRoot = document.createElement("div");
    const unrelatedChild = document.createElement("section");
    const dialogContent = document.createElement("div");
    dialogContent.dataset.dialogStackId = "dialog-1";
    portalRoot.append(unrelatedChild, dialogContent);
    document.body.append(portalRoot);

    const restore = hideElementsOutsideDialog("dialog-1");

    expect(portalRoot).not.toHaveAttribute("aria-hidden");
    expect(dialogContent).not.toHaveAttribute("aria-hidden");
    expect(unrelatedChild).toHaveAttribute("aria-hidden", "true");

    restore();

    expect(unrelatedChild).not.toHaveAttribute("aria-hidden");
  });
});
