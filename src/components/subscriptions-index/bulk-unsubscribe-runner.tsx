import { Result } from "@praha/byethrow";
import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { deleteFeed } from "@/api/tauri-commands";
import i18n from "@/lib/i18n";
import { invalidateDeleteFeedQueries } from "@/lib/query/query-invalidation";
import { getErrorMessage } from "@/lib/ui/errors";
import {
  isDatabaseMaintenanceBusyMessage,
  localizeUserVisibleAppErrorMessage,
} from "@/lib/ui/localize-app-error-message";
import {
  type BulkUnsubscribeOutcome,
  type BulkUnsubscribeRunRequest,
  useBulkUnsubscribeStore,
} from "@/stores/bulk-unsubscribe-store";
import { useUiStore } from "@/stores/ui-store";

type RunDeps = {
  queryClient: QueryClient;
  notifyCompleted: (count: number) => void;
};

async function unsubscribeFeed(feedId: string): Promise<string | null> {
  const result = await deleteFeed(feedId);
  return Result.isFailure(result) ? result.error.message : null;
}

async function executeRun(request: BulkUnsubscribeRunRequest, { queryClient, notifyCompleted }: RunDeps) {
  const { snapshot, queue, accountId, runId } = request;
  const store = useBulkUnsubscribeStore.getState();
  const isCurrent = () => useBulkUnsubscribeStore.getState().runId === runId;

  const succeededFeedIds: string[] = [];
  let failureCount = 0;
  let halt: "busy" | "cancelled" | null = null;
  let position = 0;
  let inFlightIndex: number | null = null;
  try {
    while (position < queue.length && isCurrent()) {
      const stoppedByUser = useBulkUnsubscribeStore.getState().run.stopRequested;
      const accountChanged = useUiStore.getState().subscriptionsWorkspace?.accountId !== accountId;
      if (stoppedByUser || accountChanged) {
        halt = "cancelled";
        break;
      }

      const index = queue[position];
      const feedId = snapshot[index].row.feed.id;
      inFlightIndex = index;
      store.rowRunning(index);
      const failureMessage = await unsubscribeFeed(feedId);
      position += 1;
      inFlightIndex = null;

      if (failureMessage === null) {
        succeededFeedIds.push(feedId);
        if (isCurrent()) {
          store.rowDone(index);
        }
        continue;
      }

      failureCount += 1;
      if (isCurrent()) {
        store.rowFailed(index, localizeUserVisibleAppErrorMessage(failureMessage));
      }
      if (isDatabaseMaintenanceBusyMessage(failureMessage)) {
        halt = "busy";
        break;
      }
    }
  } catch (error) {
    console.error("Bulk unsubscribe stopped on an unexpected error.", error);
    failureCount += 1;
    if (inFlightIndex !== null) {
      position += 1;
      if (isCurrent()) {
        store.rowFailed(inFlightIndex, getErrorMessage(error));
      }
    }
  } finally {
    let outcome: BulkUnsubscribeOutcome | null = null;
    if (isCurrent()) {
      outcome = halt ?? (failureCount > 0 ? "partial" : "completed");
      store.finish(outcome, queue.slice(position));
    }
    if (succeededFeedIds.length > 0) {
      invalidateDeleteFeedQueries(queryClient, { accountId });
    }
    request.onSettled(succeededFeedIds);
    if (outcome === "completed") {
      notifyCompleted(snapshot.length);
      request.onClose({ allSucceeded: true });
    }
  }
}

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
