import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { APP_EVENTS } from "@/constants/events";
import { executeAction, isAppAction } from "@/lib/actions";
import { emitDebugInputTrace } from "@/lib/debug-input-trace";
import { attachTauriListeners } from "@/lib/tauri-event-listeners";

export function useMenuEvents(): void {
  useEffect(() => {
    return attachTauriListeners(
      [
        listen<string>(APP_EVENTS.menuAction, (event) => {
          emitDebugInputTrace(`${APP_EVENTS.menuAction} ${event.payload}`);
          if (isAppAction(event.payload)) {
            executeAction(event.payload);
          } else {
            console.warn(`[menu-events] Unknown action: ${event.payload}`);
          }
        }),
      ],
      () => {
        // Non-Tauri context (browser dev mode) — no-op
      },
    );
  }, []);
}
