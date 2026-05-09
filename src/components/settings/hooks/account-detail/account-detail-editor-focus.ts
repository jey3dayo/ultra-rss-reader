import type { RefObject } from "react";

function focusAndSelectAccountDetailInput(input: HTMLInputElement | null): boolean {
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

export function scheduleAccountDetailInputFocus(ref: RefObject<HTMLInputElement | null>): () => void {
  let canceled = false;
  const focusInput = () => {
    if (canceled) {
      return;
    }
    focusAndSelectAccountDetailInput(ref.current);
  };

  if (typeof globalThis.requestAnimationFrame === "function") {
    const frameId = globalThis.requestAnimationFrame(focusInput);
    return () => {
      canceled = true;
      globalThis.cancelAnimationFrame?.(frameId);
    };
  }

  const timeoutId = globalThis.setTimeout(focusInput, 0);
  return () => {
    canceled = true;
    globalThis.clearTimeout(timeoutId);
  };
}
