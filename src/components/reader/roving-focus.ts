import type { RefObject } from "react";

export function getLoopedFocusIndex(itemCount: number, index: number) {
  if (!Number.isInteger(itemCount) || itemCount <= 0) {
    return null;
  }

  return (index + itemCount) % itemCount;
}

export function getActiveRovingButtonIndex(
  itemRefs: RefObject<Array<HTMLButtonElement | null> | null>,
  activeElement: Element | null,
): number {
  if (!(activeElement instanceof HTMLButtonElement)) {
    return -1;
  }

  return itemRefs.current?.indexOf(activeElement) ?? -1;
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
