import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { focusRovingButton, getActiveRovingButtonIndex, getLoopedFocusIndex } from "@/lib/dom/roving-focus";

describe("roving-focus", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("wraps indices within the available item count", () => {
    expect(getLoopedFocusIndex(3, 0)).toBe(0);
    expect(getLoopedFocusIndex(3, 3)).toBe(0);
    expect(getLoopedFocusIndex(3, -1)).toBe(2);
    expect(getLoopedFocusIndex(0, 1)).toBeNull();
    expect(getLoopedFocusIndex(-1, 1)).toBeNull();
    expect(getLoopedFocusIndex(1.5, 1)).toBeNull();
    expect(getLoopedFocusIndex(3, 1000)).toBe(1);
  });

  it("focuses the normalized button ref when available", () => {
    const buttons = [document.createElement("button"), document.createElement("button")];
    document.body.append(...buttons);
    const focusSpy = vi.spyOn(buttons[1], "focus");
    const itemRefs = createRef<Array<HTMLButtonElement | null>>();
    itemRefs.current = buttons;

    focusRovingButton(itemRefs, buttons.length, -1);

    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it("falls through to the next available button when the normalized target is missing", () => {
    const buttons = [document.createElement("button")];
    document.body.append(...buttons);
    const focusSpy = vi.spyOn(buttons[0], "focus");
    const itemRefs = createRef<Array<HTMLButtonElement | null>>();
    itemRefs.current = [buttons[0], null];

    focusRovingButton(itemRefs, 2, 1);

    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it("leaves focus unchanged without refs or items", () => {
    const buttons = [document.createElement("button")];
    document.body.append(...buttons);
    const focusSpy = vi.spyOn(buttons[0], "focus");
    const itemRefs = createRef<Array<HTMLButtonElement | null>>();

    focusRovingButton(itemRefs, buttons.length, 0);
    itemRefs.current = buttons;
    focusRovingButton(itemRefs, 0, 0);

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("resolves the active button index from roving refs", () => {
    const buttons = [document.createElement("button"), document.createElement("button")];
    document.body.append(...buttons);
    const itemRefs = createRef<Array<HTMLButtonElement | null>>();
    itemRefs.current = buttons;

    expect(getActiveRovingButtonIndex(itemRefs, buttons[1])).toBe(1);
    expect(getActiveRovingButtonIndex(itemRefs, document.createElement("button"))).toBe(-1);
    expect(getActiveRovingButtonIndex(itemRefs, null)).toBe(-1);
  });

  it("skips disabled, hidden, and disconnected targets when moving focus", () => {
    const buttons = [
      document.createElement("button"),
      document.createElement("button"),
      document.createElement("button"),
    ];
    buttons[0].disabled = true;
    buttons[1].setAttribute("aria-hidden", "true");
    document.body.append(buttons[0], buttons[1], buttons[2]);
    const focusSpy = vi.spyOn(buttons[2], "focus");
    const itemRefs = createRef<Array<HTMLButtonElement | null>>();
    itemRefs.current = buttons;

    focusRovingButton(itemRefs, buttons.length, 0);

    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it("ignores active elements that are no longer valid roving targets", () => {
    const buttons = [document.createElement("button"), document.createElement("button")];
    buttons[1].disabled = true;
    document.body.append(...buttons);
    const itemRefs = createRef<Array<HTMLButtonElement | null>>();
    itemRefs.current = buttons;

    expect(getActiveRovingButtonIndex(itemRefs, buttons[1])).toBe(-1);
  });
});
