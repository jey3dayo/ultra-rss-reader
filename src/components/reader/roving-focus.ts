import type { RefObject } from "react";

export function getLoopedFocusIndex(itemCount: number, index: number) {
  if (itemCount === 0) {
    return null;
  }

  return (index + itemCount) % itemCount;
}

export function focusRovingButton(
  itemRefs: RefObject<Array<HTMLButtonElement | null> | null>,
  itemCount: number,
  index: number,
) {
  const normalizedIndex = getLoopedFocusIndex(itemCount, index);
  if (normalizedIndex === null || !itemRefs.current) {
    return;
  }

  itemRefs.current[normalizedIndex]?.focus();
}
