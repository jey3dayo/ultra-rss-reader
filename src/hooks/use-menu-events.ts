import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { executeAction, isAppAction } from "@/lib/actions";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";

export function useMenuEvents(): void {
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    listen<string>("menu-action", (event) => {
      emitDebugInputTrace(`menu-action ${event.payload}`);
      if (isAppAction(event.payload)) {
        executeAction(event.payload);
      } else {
        console.warn(`[menu-events] Unknown action: ${event.payload}`);
      }
    })
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
