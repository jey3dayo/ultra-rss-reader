import type { RefObject } from "react";

export function focusAndSelectAccountDetailInput(input: HTMLInputElement | null): boolean {
  if (!input) {
    return false;
  }

  input.focus();
  input.select();
  return true;
}

export function focusFirstAccountDetailInput(refs: Array<RefObject<HTMLInputElement | null>>): boolean {
  return refs.some((ref) => focusAndSelectAccountDetailInput(ref.current));
}

export function scheduleAccountDetailInputFocus(ref: RefObject<HTMLInputElement | null>): void {
  requestAnimationFrame(() => {
    focusAndSelectAccountDetailInput(ref.current);
  });
}
