import { useBrowserUrlEffect } from "@/components/reader/hooks/browser/use-browser-url-effect";
import { hasOpenDialogTopLayer } from "@/lib/dom/top-layer";
import { bindWindowEvents, createKeyboardEventListener } from "@/lib/window/window-events";

type UseBrowserOverlayShortcutsParams = {
  browserUrl: string | null;
  handleCloseOverlay: () => void;
};

export function useBrowserOverlayShortcuts({ browserUrl, handleCloseOverlay }: UseBrowserOverlayShortcutsParams) {
  // Keep this separate from the similar lifecycle hooks: it owns only Escape
  // priority while a browser URL is active, not mouse or resize lifecycle.
  useBrowserUrlEffect(browserUrl, () => {
    const handleKeyDown = createKeyboardEventListener((event) => {
      if (event.key !== "Escape" || event.defaultPrevented || hasOpenDialogTopLayer()) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      handleCloseOverlay();
    });

    const removeWindowEvents = bindWindowEvents([{ type: "keydown", listener: handleKeyDown, options: true }]);
    return () => {
      removeWindowEvents();
    };
  }, [handleCloseOverlay]);
}
