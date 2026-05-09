import { useEffect } from "react";
import { executeAction } from "@/lib/actions";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import { isGlobalShortcutTextEditingTarget } from "@/lib/keyboard/global-shortcut-targets";
import {
  bindWindowEvents,
  createMouseEventListener,
} from "@/lib/window/window-events";

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && isGlobalShortcutTextEditingTarget(target);
}

function hasActiveBlockingLayer(): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  if (
    document.querySelector(
      '[role="dialog"], [aria-modal="true"], [data-slot="dialog-overlay"], [role="menu"]',
    )
  ) {
    return true;
  }

  const browserOverlayRoot = document.querySelector<HTMLElement>(
    "[data-browser-overlay-root]",
  );
  return browserOverlayRoot?.classList.contains("pointer-events-auto") ?? false;
}

function isIgnoredMouseNavigationTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return hasActiveBlockingLayer();
  }

  if (target.closest('[data-disable-global-shortcuts="true"]')) {
    return true;
  }

  return isEditableTarget(target) || hasActiveBlockingLayer();
}

function isMouseNavigationButton(event: MouseEvent): boolean {
  return event.button === 3 || event.button === 4;
}

export function useMouseNavigation() {
  // Keep this separate from the similar browser lifecycle hooks: it owns global
  // mouse side-button capture and must not inherit URL or keyboard semantics.
  useEffect(() => {
    const handleMouseDown = createMouseEventListener((event) => {
      if (
        !isMouseNavigationButton(event) ||
        event.defaultPrevented ||
        isIgnoredMouseNavigationTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    });

    const handleMouseUp = createMouseEventListener((event) => {
      if (
        !isMouseNavigationButton(event) ||
        event.defaultPrevented ||
        isIgnoredMouseNavigationTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const action = event.button === 3 ? "mouse-back" : "mouse-forward";
      emitDebugInputTrace(`window-mouse ${event.button} -> ${action}`);
      executeAction(action);
    });

    return bindWindowEvents([
      { type: "mousedown", listener: handleMouseDown, options: true },
      { type: "mouseup", listener: handleMouseUp, options: true },
    ]);
  }, []);
}
