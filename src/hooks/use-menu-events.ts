import { useEffect } from "react";
import { executeAction, isAppAction } from "@/lib/actions";

export function useMenuEvents(): void {
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<string>("menu-action", (event) => {
          if (isAppAction(event.payload)) {
            executeAction(event.payload);
          } else {
            console.warn(`[menu-events] Unknown action: ${event.payload}`);
          }
        }),
      )
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {
        // Non-Tauri context (browser dev mode) — no-op
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
}
