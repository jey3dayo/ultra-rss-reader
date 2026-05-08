import { useBrowserUrlEffect } from "@/components/reader/hooks/browser/use-browser-url-effect";
import { bindWindowEvents, createKeyboardEventListener } from "@/lib/window/window-events";

type UseBrowserOverlayShortcutsParams = {
  browserUrl: string | null;
  handleCloseOverlay: () => void;
};

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
