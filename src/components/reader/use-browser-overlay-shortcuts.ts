import type { UseBrowserOverlayShortcutsParams } from "./browser-view.types";
import { bindWindowEvents, useBrowserUrlEffect } from "./use-browser-url-effect";

export function useBrowserOverlayShortcuts({ browserUrl, handleCloseOverlay }: UseBrowserOverlayShortcutsParams) {
  useBrowserUrlEffect(browserUrl, () => {
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('[data-testid="browser-overlay-chrome"] button')?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      handleCloseOverlay();
    };

    const removeWindowEvents = bindWindowEvents([{ type: "keydown", listener: handleKeyDown }]);
    return () => {
      window.cancelAnimationFrame(frame);
      removeWindowEvents();
    };
  }, [handleCloseOverlay]);
}
