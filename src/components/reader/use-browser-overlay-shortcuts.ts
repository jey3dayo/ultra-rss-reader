import { createKeyboardEventListener } from "@/lib/window-events";
import type { UseBrowserOverlayShortcutsParams } from "./browser-view.types";
import { bindWindowEvents, useBrowserUrlEffect } from "./use-browser-url-effect";

export function useBrowserOverlayShortcuts({ browserUrl, handleCloseOverlay }: UseBrowserOverlayShortcutsParams) {
  useBrowserUrlEffect(browserUrl, () => {
    const handleKeyDown = createKeyboardEventListener((event) => {
      if (event.key !== "Escape" || event.defaultPrevented) {
        return;
      }

      event.preventDefault();
      handleCloseOverlay();
    });

    const removeWindowEvents = bindWindowEvents([{ type: "keydown", listener: handleKeyDown }]);
    return () => {
      removeWindowEvents();
    };
  }, [handleCloseOverlay]);
}
