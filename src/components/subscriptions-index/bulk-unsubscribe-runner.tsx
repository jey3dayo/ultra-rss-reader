import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import i18n from "@/lib/i18n";
import { attachTauriListeners, listenTauriEvent } from "@/lib/runtime/tauri-event-listeners";
import { useBulkUnsubscribeStore } from "@/stores/bulk-unsubscribe-store";
import { useUiStore } from "@/stores/ui-store";
import { executeRun } from "./bulk-unsubscribe-run";

export function BulkUnsubscribeRunner() {
  const queryClient = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);

  useEffect(() => {
    const { setRunnerMounted } = useBulkUnsubscribeStore.getState();
    setRunnerMounted(true);
    const unsubscribeRequest = useBulkUnsubscribeStore.subscribe((state, previous) => {
      if (state.request !== null && state.request !== previous.request) {
        void executeRun(state.request, { queryClient });
      }
    });
    // A completed run always toasts. A partial or cancelled run toasts only when the dialog is
    // closed, because an open dialog already shows the same result on its result step.
    const unsubscribeSettled = useBulkUnsubscribeStore.subscribe((state, previous) => {
      const settled = state.lastSettled;
      if (settled === null || settled === previous.lastSettled) {
        return;
      }
      const rows = state.run.rows;
      const doneCount = rows.filter((row) => row.status === "done").length;
      if (settled.outcome === "completed") {
        showToast(i18n.t("subscriptions:bulk_toast_done", { count: doneCount }));
        return;
      }
      if (state.dialogOpen) {
        return;
      }
      if (settled.outcome === "partial") {
        const failedCount = rows.filter((row) => row.status === "failed").length;
        showToast({
          message: i18n.t("subscriptions:bulk_result_partial", { succeeded: doneCount, failed: failedCount }),
          severity: "error",
        });
        return;
      }
      const skippedCount = rows.filter((row) => row.status === "skipped").length;
      showToast(i18n.t("subscriptions:bulk_result_cancelled", { succeeded: doneCount, skipped: skippedCount }));
    });
    const disposeListeners = attachTauriListeners([
      listenTauriEvent("sync-completed", () => useBulkUnsubscribeStore.getState().notifySyncCompleted()),
    ]);
    return () => {
      unsubscribeRequest();
      unsubscribeSettled();
      disposeListeners();
      setRunnerMounted(false);
    };
  }, [queryClient, showToast]);

  return null;
}
