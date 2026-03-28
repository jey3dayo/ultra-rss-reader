import { useEffect } from "react";
import { executeAction } from "@/lib/actions";

export function useMenuEvents(): void {
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<string>("menu-action", (event) => {
          executeAction(event.payload);
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
