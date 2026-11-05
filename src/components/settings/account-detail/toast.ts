import type { TFunction } from "i18next";
import { redactProviderRuntimeDiagnosticText } from "@/lib/runtime/diagnostics";
import type { UiDisplayState } from "@/lib/ui/display-state.types";
import { localizeUserVisibleAppErrorMessage } from "@/lib/ui/localize-app-error-message";
import { useUiStore } from "@/stores/ui-store";

type AccountDetailError = UiDisplayState;

type AccountDetailErrorToastKey =
  | "account.failed_to_rename"
  | "account.failed_to_update_sync"
  | "account.credential_save_failed"
  | "account.connection_failed"
  | "account.saved_connection_unconfirmed"
  | "account.copy_server_url_failed"
  | "account.sync_failed"
  | "account.failed_to_import_opml"
  | "account.failed_to_export_opml"
  | "account.local_sync_settings_failed"
  | "account.local_sync_export_failed"
  | "account.local_sync_import_failed"
  | "account.failed_to_delete";

type AccountDetailErrorToastOptions = {
  persistMessage?: (message: string) => void;
};

function formatAccountDetailErrorMessage(
  t: TFunction<"settings">,
  key: AccountDetailErrorToastKey,
  error: AccountDetailError,
): string {
  return t(key, {
    message: redactProviderRuntimeDiagnosticText(localizeUserVisibleAppErrorMessage(error.message)),
  });
}

export function createAccountDetailErrorToast(
  t: TFunction<"settings">,
  key: AccountDetailErrorToastKey,
  options?: AccountDetailErrorToastOptions,
) {
  return (error: AccountDetailError) => {
    const message = formatAccountDetailErrorMessage(t, key, error);
    useUiStore.getState().showToast({
      message,
      severity: key === "account.saved_connection_unconfirmed" ? "warning" : "error",
    });
    options?.persistMessage?.(message);
  };
}
