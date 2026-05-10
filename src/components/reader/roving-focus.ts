import type { RefObject } from "react";

function isRovingButtonFocusable(button: HTMLButtonElement | null): button is HTMLButtonElement {
  if (!button?.isConnected || button.disabled || button.getAttribute("aria-disabled") === "true") {
    return false;
  }

  return button.closest("[hidden], [aria-hidden='true'], [inert]") === null;
}

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

  if (!isRovingButtonFocusable(activeElement)) {
    return -1;
  }

  return itemRefs.current?.findIndex((button) => button === activeElement && isRovingButtonFocusable(button)) ?? -1;
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

  for (let offset = 0; offset < itemCount; offset += 1) {
    const targetIndex = getLoopedFocusIndex(itemCount, normalizedIndex + offset);
    const target = targetIndex === null ? null : itemRefs.current[targetIndex];
    if (!isRovingButtonFocusable(target)) {
      continue;
    }

    target.focus();
    return;
  }
}
