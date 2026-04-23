import { useEffect } from "react";
import { executeAction } from "@/lib/actions";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    return true;
  }

  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"], [role="searchbox"]',
    ),
  );
}

function isIgnoredMouseNavigationTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.closest('[data-disable-global-shortcuts="true"]')) {
    return true;
  }

  return isEditableTarget(target);
}

function isMouseNavigationButton(event: MouseEvent): boolean {
  return event.button === 3 || event.button === 4;
}

export function useMouseNavigation() {
  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (!isMouseNavigationButton(event) || event.defaultPrevented || isIgnoredMouseNavigationTarget(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (!isMouseNavigationButton(event) || event.defaultPrevented || isIgnoredMouseNavigationTarget(event.target)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const action = event.button === 3 ? "mouse-back" : "mouse-forward";
      emitDebugInputTrace(`window-mouse ${event.button} -> ${action}`);
      executeAction(action);
    };

    window.addEventListener("mousedown", handleMouseDown, true);
    window.addEventListener("mouseup", handleMouseUp, true);

    return () => {
      window.removeEventListener("mousedown", handleMouseDown, true);
      window.removeEventListener("mouseup", handleMouseUp, true);
    };
  }, []);
}
