import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { focusRovingButton, getActiveRovingButtonIndex, getLoopedFocusIndex } from "@/components/reader/roving-focus";

describe("roving-focus", () => {
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
    const focusSpy = vi.spyOn(buttons[1], "focus");
    const itemRefs = createRef<Array<HTMLButtonElement | null>>();
    itemRefs.current = buttons;

    focusRovingButton(itemRefs, buttons.length, -1);

    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it("leaves focus unchanged when normalized target is missing", () => {
    const buttons = [document.createElement("button")];
    const focusSpy = vi.spyOn(buttons[0], "focus");
    const itemRefs = createRef<Array<HTMLButtonElement | null>>();
    itemRefs.current = [buttons[0], null];

    focusRovingButton(itemRefs, 2, 1);

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("leaves focus unchanged without refs or items", () => {
    const buttons = [document.createElement("button")];
    const focusSpy = vi.spyOn(buttons[0], "focus");
    const itemRefs = createRef<Array<HTMLButtonElement | null>>();

    focusRovingButton(itemRefs, buttons.length, 0);
    itemRefs.current = buttons;
    focusRovingButton(itemRefs, 0, 0);

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("resolves the active button index from roving refs", () => {
    const buttons = [document.createElement("button"), document.createElement("button")];
    const itemRefs = createRef<Array<HTMLButtonElement | null>>();
    itemRefs.current = buttons;

    expect(getActiveRovingButtonIndex(itemRefs, buttons[1])).toBe(1);
    expect(getActiveRovingButtonIndex(itemRefs, document.createElement("button"))).toBe(-1);
    expect(getActiveRovingButtonIndex(itemRefs, null)).toBe(-1);
  });
});
