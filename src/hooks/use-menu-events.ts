import { useEffect } from "react";
import { APP_EVENTS } from "@/constants/events";
import { executeAction } from "@/lib/actions";
import {
  type AppAction,
  type AppActionUnavailableReason,
  getAppActionUnavailableReason,
  isAppAction,
} from "@/lib/app-actions";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import i18n from "@/lib/i18n";
import { formatRuntimeDiagnosticPayload, logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";
import { attachTauriListeners, listenTauriEvent } from "@/lib/runtime/tauri-event-listeners";
import { useUiStore } from "@/stores/ui-store";

function getMenuActionUnavailableReason(action: AppAction): AppActionUnavailableReason | null {
  const state = useUiStore.getState();
  return getAppActionUnavailableReason(action, "nativeMenu", {
    selectedAccountId: state.selectedAccountId,
    selectedArticleId: state.selectedArticleId,
    contentMode: state.contentMode,
    commandPaletteOpen: state.commandPaletteOpen,
    settingsOpen: state.settingsOpen,
    confirmDialogOpen: state.confirmDialog.open,
    shortcutsHelpOpen: state.shortcutsHelpOpen,
    isAddFeedDialogOpen: state.isAddFeedDialogOpen,
  });
}

function getBlockedMenuActionMessage(reason: AppActionUnavailableReason | null): string | null {
  switch (reason) {
    case "modal-open":
      return i18n.t("reader:menu_action_blocked_by_dialog");
    case "requires-article":
      return i18n.t("reader:menu_action_requires_article");
    default:
      return null;
  }
}

export function useMenuEvents(): void {
  useEffect(() => {
    return attachTauriListeners(
      [
        listenTauriEvent<unknown>(APP_EVENTS.menuAction, (event) => {
          const formattedPayload = formatRuntimeDiagnosticPayload(event.payload);
          emitDebugInputTrace(`${APP_EVENTS.menuAction} ${formattedPayload}`);
          if (isAppAction(event.payload)) {
            const store = useUiStore.getState();
            if (event.payload === "open-settings" && store.settingsOpen) {
              emitDebugInputTrace(`${APP_EVENTS.menuAction} blocked ${formattedPayload}`);
              return;
            }
            const blockedMessage = getBlockedMenuActionMessage(getMenuActionUnavailableReason(event.payload));
            if (blockedMessage !== null) {
              emitDebugInputTrace(`${APP_EVENTS.menuAction} blocked ${formattedPayload}`);
              store.showToast(blockedMessage);
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
