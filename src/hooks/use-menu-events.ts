import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { APP_EVENTS } from "@/constants/events";
import { executeAction } from "@/lib/actions";
import { isAppAction } from "@/lib/app-actions";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import { attachTauriListeners } from "@/lib/runtime/tauri-event-listeners";

function formatMenuActionPayload(payload: unknown): string {
  try {
    return String(payload);
  } catch {
    return "[unformattable payload]";
  }
}

export function useMenuEvents(): void {
  useEffect(() => {
    return attachTauriListeners(
      [
        listen<unknown>(APP_EVENTS.menuAction, (event) => {
          const formattedPayload = formatMenuActionPayload(event.payload);
          emitDebugInputTrace(`${APP_EVENTS.menuAction} ${formattedPayload}`);
          if (isAppAction(event.payload)) {
            executeAction(event.payload);
          } else {
            console.warn(`[menu-events] Unknown action: ${formattedPayload}`);
          }
        }),
      ],
      {
        onUnavailable: (error) => {
          emitDebugInputTrace(`${APP_EVENTS.menuAction} listener unavailable`);
          console.debug("[menu-events] Tauri menu listener unavailable.", error);
        },
      },
    );
  }, []);
}
