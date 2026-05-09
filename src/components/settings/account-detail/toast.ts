import type { TFunction } from "i18next";
import type { UiDisplayState } from "@/lib/ui/display-state.types";
import { useUiStore } from "@/stores/ui-store";

type AccountDetailError = Pick<UiDisplayState, "message">;

type AccountDetailErrorToastKey =
  | "account.failed_to_rename"
  | "account.failed_to_update_sync"
  | "account.connection_failed"
  | "account.copy_server_url_failed"
  | "account.sync_failed"
  | "account.failed_to_export_opml"
  | "account.failed_to_delete";

export function createAccountDetailErrorToast(t: TFunction<"settings">, key: AccountDetailErrorToastKey) {
  return (error: AccountDetailError) => {
    useUiStore.getState().showToast(t(key, { message: error.message }));
  };
}
