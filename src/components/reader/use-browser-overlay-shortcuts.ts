import { useEffect } from "react";

type UseBrowserOverlayShortcutsParams = {
  browserUrl: string | null;
  handleCloseOverlay: () => void;
};

export function useBrowserOverlayShortcuts({ browserUrl, handleCloseOverlay }: UseBrowserOverlayShortcutsParams) {
  useEffect(() => {
    if (!browserUrl) {
      return undefined;
    }

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

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [browserUrl, handleCloseOverlay]);
}
