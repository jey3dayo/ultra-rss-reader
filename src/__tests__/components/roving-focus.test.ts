import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { focusRovingButton, getLoopedFocusIndex } from "@/components/reader/roving-focus";

describe("roving-focus", () => {
  it("wraps indices within the available item count", () => {
    expect(getLoopedFocusIndex(3, 0)).toBe(0);
    expect(getLoopedFocusIndex(3, 3)).toBe(0);
    expect(getLoopedFocusIndex(3, -1)).toBe(2);
    expect(getLoopedFocusIndex(0, 1)).toBeNull();
  });

  it("focuses the normalized button ref when available", () => {
    const buttons = [document.createElement("button"), document.createElement("button")];
    const focusSpy = vi.spyOn(buttons[1], "focus");
    const itemRefs = createRef<Array<HTMLButtonElement | null>>();
    itemRefs.current = buttons;

    focusRovingButton(itemRefs, buttons.length, -1);

    expect(focusSpy).toHaveBeenCalledTimes(1);
  });
});
