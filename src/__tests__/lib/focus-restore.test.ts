import { afterEach, describe, expect, it, vi } from "vitest";
import { getRestorableActiveElement, restoreFocusOnMicrotask } from "@/lib/dom/focus-restore";

describe("focus restore DOM helpers", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("returns the active HTMLElement for later focus restore", () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();

    expect(getRestorableActiveElement()).toBe(button);
  });

  it("returns null without a document or HTMLElement active element", () => {
    const activeElementSpy = vi.spyOn(document, "activeElement", "get").mockReturnValue(null);

    try {
      expect(getRestorableActiveElement()).toBeNull();
      expect(getRestorableActiveElement(null)).toBeNull();
    } finally {
      activeElementSpy.mockRestore();
    }
  });

  it("restores focus on the next microtask when the target is still connected", async () => {
    const button = document.createElement("button");
    const otherButton = document.createElement("button");
    document.body.append(button, otherButton);
    otherButton.focus();

    restoreFocusOnMicrotask(button);
    expect(document.activeElement).toBe(otherButton);

    await Promise.resolve();

    expect(document.activeElement).toBe(button);
  });

  it("does not restore focus to a removed target", async () => {
    const button = document.createElement("button");
    const otherButton = document.createElement("button");
    document.body.append(button, otherButton);
    otherButton.focus();
    button.remove();

    restoreFocusOnMicrotask(button);
    await Promise.resolve();

    expect(document.activeElement).toBe(otherButton);
  });
});
