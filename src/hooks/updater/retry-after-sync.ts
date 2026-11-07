import i18n from "@/lib/i18n";
import type { ToastData } from "@/lib/ui/toast.types";
import { useUiStore } from "@/stores/ui-store";

export const RETRY_AFTER_SYNC_INTERVAL_MS = 5_000;

let cancelPending: (() => void) | null = null;

export function waitForSyncRetry(options: {
  message: string;
  retry: (isPending: () => boolean) => Promise<boolean>;
  onCancel?: () => void;
}): void {
  if (cancelPending) return;
  let pending = true;
  let inFlight = false;
  let unsubscribe = () => {};
  let timer: ReturnType<typeof setInterval>;
  const stop = () => {
    pending = false;
    unsubscribe();
    clearInterval(timer);
    cancelPending = null;
  };
  const toast: ToastData = {
    message: options.message,
    persistent: true,
    variant: "update",
    actions: [
      {
        label: i18n.t("updater.cancel_restart_pending"),
        onClick: () => {
          if (!pending) return;
          stop();
          if (useUiStore.getState().toastMessage === toast) useUiStore.getState().clearToast();
          options.onCancel?.();
        },
      },
    ],
  };
  const retry = () => {
    if (!pending || inFlight) return;
    inFlight = true;
    void options
      .retry(() => pending)
      .then((busy) => {
        inFlight = false;
        if (pending && !busy) stop();
      })
      .catch((error: unknown) => {
        if (pending) stop();
        console.error("Update retry failed:", error);
      });
  };
  cancelPending = stop;
  unsubscribe = useUiStore.subscribe((state, previous) => {
    if (previous.syncProgress.active && !state.syncProgress.active) retry();
  });
  timer = setInterval(retry, RETRY_AFTER_SYNC_INTERVAL_MS);
  useUiStore.getState().showToast(toast);
  if (!useUiStore.getState().syncProgress.active) retry();
}

export function isWaitingForSyncRetry(): boolean {
  return cancelPending !== null;
}

export function resetSyncRetryForTests(): void {
  cancelPending?.();
}
