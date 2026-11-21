import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import i18n from "@/lib/i18n";
import { useBulkUnsubscribeStore } from "@/stores/bulk-unsubscribe-store";
import { useUiStore } from "@/stores/ui-store";
import { executeRun } from "./bulk-unsubscribe-run";

export function BulkUnsubscribeRunner() {
  const queryClient = useQueryClient();
  const showToast = useUiStore((state) => state.showToast);

  useEffect(() => {
    const { setRunnerMounted } = useBulkUnsubscribeStore.getState();
    setRunnerMounted(true);
    const unsubscribe = useBulkUnsubscribeStore.subscribe((state, previous) => {
      if (state.request !== null && state.request !== previous.request) {
        void executeRun(state.request, {
          queryClient,
          notifyCompleted: (count) => showToast(i18n.t("subscriptions:bulk_toast_done", { count })),
        });
      }
    });
    return () => {
      unsubscribe();
      setRunnerMounted(false);
    };
  }, [queryClient, showToast]);

  return null;
}
