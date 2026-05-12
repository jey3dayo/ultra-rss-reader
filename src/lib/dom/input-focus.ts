type InputRef = {
  current: HTMLInputElement | null;
};

export function focusAndSelectInput(input: HTMLInputElement | null): boolean {
  if (!input) {
    return false;
  }

  input.focus();
  input.select();
  return true;
}

export function focusFirstInput(refs: InputRef[]): boolean {
  return refs.some((ref) => focusAndSelectInput(ref.current));
}

export function scheduleInputFocus(ref: InputRef): () => void {
  let canceled = false;
  const focusInput = () => {
    if (canceled) {
      return;
    }
    focusAndSelectInput(ref.current);
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
