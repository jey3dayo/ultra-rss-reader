import { useEffect } from "react";
import { APP_EVENTS } from "@/constants/events";
import { executeAction } from "@/lib/actions";
import { type AppAction, getAppActionUnavailableReason, isAppAction } from "@/lib/app-actions";
import { emitDebugInputTrace } from "@/lib/debug/debug-input-trace";
import i18n from "@/lib/i18n";
import { formatRuntimeDiagnosticPayload, logRuntimeDiagnostic } from "@/lib/runtime/diagnostics";
import { attachTauriListeners, listenTauriEvent } from "@/lib/runtime/tauri-event-listeners";
import { useUiStore } from "@/stores/ui-store";

function resolveMenuActionRejectionMessage(action: AppAction): string | null {
  const state = useUiStore.getState();
  const reason = getAppActionUnavailableReason(action, "nativeMenu", {
    selectedAccountId: state.selectedAccountId,
    selectedArticleId: state.selectedArticleId,
    contentMode: state.contentMode,
    commandPaletteOpen: state.commandPaletteOpen,
    settingsOpen: state.settingsOpen,
    shortcutsHelpOpen: state.shortcutsHelpOpen,
    isAddFeedDialogOpen: state.isAddFeedDialogOpen,
    confirmDialogOpen: state.confirmDialog.open,
  });
  switch (reason) {
    case "modal-open":
      return i18n.t("reader:menu_action_dialog_open");
    case "requires-article":
      return i18n.t("reader:menu_action_article_required");
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
            if (event.payload === "open-settings" && useUiStore.getState().settingsOpen) {
              emitDebugInputTrace(`${APP_EVENTS.menuAction} blocked ${formattedPayload}`);
              return;
            }
            const rejectionMessage = resolveMenuActionRejectionMessage(event.payload);
            if (rejectionMessage !== null) {
              emitDebugInputTrace(`${APP_EVENTS.menuAction} blocked ${formattedPayload}`);
              useUiStore.getState().showToast(rejectionMessage);
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
