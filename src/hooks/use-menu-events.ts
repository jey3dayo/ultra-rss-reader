import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { APP_EVENTS } from "@/constants/events";
import { executeAction } from "@/lib/actions";
import { isAppAction } from "@/lib/app-actions";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import { isModalBlockedMenuAction } from "@/lib/keyboard/global-shortcut-targets";
import { formatRuntimeDiagnosticPayload, logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";
import { attachTauriListeners } from "@/lib/runtime/tauri-event-listeners";
import { useUiStore } from "@/stores/ui-store";

function isMenuActionBlockedByModal(): boolean {
  const state = useUiStore.getState();
  return state.settingsOpen || state.confirmDialog.open || state.shortcutsHelpOpen || state.commandPaletteOpen;
}

export function useMenuEvents(): void {
  useEffect(() => {
    return attachTauriListeners(
      [
        listen<unknown>(APP_EVENTS.menuAction, (event) => {
          const formattedPayload = formatRuntimeDiagnosticPayload(event.payload);
          emitDebugInputTrace(`${APP_EVENTS.menuAction} ${formattedPayload}`);
          if (isAppAction(event.payload)) {
            if (isMenuActionBlockedByModal() && isModalBlockedMenuAction(event.payload)) {
              emitDebugInputTrace(`${APP_EVENTS.menuAction} blocked ${formattedPayload}`);
              return;
            }
            try {
              executeAction(event.payload);
            } catch (error) {
              logRuntimeDiagnostic("menu-action", `[menu-events] ${event.payload} failed.`, error);
              emitDebugInputTrace(`${APP_EVENTS.menuAction} failed ${formattedPayload}`);
            }
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
