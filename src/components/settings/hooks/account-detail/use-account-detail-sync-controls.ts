import { Result } from "@praha/byethrow";
import type { QueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useRef, useState } from "react";
import { syncAccount, updateAccountSync } from "@/api/tauri-commands";
import type { AccountSetupSessionOwner, AccountSetupSessionState } from "@/lib/account/account-setup-session.types";
import {
  invalidateArticleQueries,
  invalidateFeedQueries,
  invalidateQueryKeysLogOnly,
  queryKeys,
} from "@/lib/query/query-invalidation";
import { resolveSyncFeedbackMessage, summarizeSyncResult } from "@/lib/sync/sync-result-feedback";
import { getErrorMessage } from "@/lib/ui/errors";
import { useUiStore } from "@/stores/ui-store";
import { updateCachedAccount } from "../../account-detail/query-cache";
import type { AccountSelectOption, UpdateAccountSyncParams } from "../../account-detail/sync.types";
import { createAccountDetailErrorToast } from "../../account-detail/toast";
import type { AccountDetailAccount } from "../../account-detail/types";

type AccountDetailSyncControlsParams = {
  account: AccountDetailAccount;
  queryClient: QueryClient;
  t: TFunction<"settings">;
  onSyncStatusChanged?: () => void;
  accountSetupState?: AccountSetupSessionState | null;
};

export type AccountDetailSyncControlsResult = {
  handleSyncUpdate: (partial: UpdateAccountSyncParams) => Promise<void>;
  handleSyncNow: () => Promise<void>;
  handleSetupRetry: () => Promise<void>;
  syncActionInFlight: boolean;
  syncIntervalOptions: AccountSelectOption[];
  keepReadItemsOptions: AccountSelectOption[];
};

type RunAccountSetupSyncParams = {
  accountId: string;
  queryClient: QueryClient;
  t: TFunction<"settings">;
  onSyncStatusChanged?: () => void;
  owner?: AccountSetupSessionOwner;
  shouldApplyFinalUiAction?: () => boolean;
};

function resolveSetupFailureMessage(t: TFunction<"settings">, syncResult: Awaited<ReturnType<typeof syncAccount>>) {
  if (Result.isFailure(syncResult)) {
    return t("account.sync_failed", {
      message: Result.unwrapError(syncResult).message,
    });
  }

  return resolveSyncFeedbackMessage(summarizeSyncResult(Result.unwrap(syncResult)), {
    alreadyInProgress: t("account.syncing_now"),
    partialFailure: (accounts) => t("account.sync_failed", { message: accounts }),
    retryScheduled: () => t("account.sync_completed_with_retry_pending"),
    retryPending: () => t("account.sync_completed_with_retry_pending"),
    warnings: () => t("account.sync_completed_with_warnings"),
    success: t("account.sync_complete"),
  });
}

export async function runAccountSetupSync({
  accountId,
  queryClient,
  t,
  onSyncStatusChanged,
  owner,
  shouldApplyFinalUiAction,
}: RunAccountSetupSyncParams) {
  useUiStore.getState().startAccountSetup(accountId, { owner });

  let syncResult: Awaited<ReturnType<typeof syncAccount>>;
  try {
    syncResult = await syncAccount(accountId);
  } catch (error) {
    onSyncStatusChanged?.();
    invalidateQueryKeysLogOnly(queryClient, [["account-sync-status"]]);
    useUiStore
      .getState()
      .markAccountSetupFailed(accountId, t("account.sync_failed", { message: getErrorMessage(error) }));
    return;
  }

  onSyncStatusChanged?.();
  invalidateQueryKeysLogOnly(queryClient, [["account-sync-status"]]);

  if (Result.isFailure(syncResult)) {
    useUiStore.getState().markAccountSetupFailed(accountId, resolveSetupFailureMessage(t, syncResult));
    return;
  }

  invalidateFeedQueries(queryClient, { includeFolders: false });
  invalidateArticleQueries(queryClient, { includeFeedIntegrityReport: false });

  const feedback = summarizeSyncResult(Result.unwrap(syncResult));
  if (feedback.kind !== "success") {
    useUiStore.getState().markAccountSetupFailed(accountId, resolveSetupFailureMessage(t, syncResult));
    return;
  }

  const uiState = useUiStore.getState();
  uiState.markAccountSetupSucceeded(accountId);
  if (shouldApplyFinalUiAction && !shouldApplyFinalUiAction()) {
    uiState.clearAccountSetup();
    return;
  }
  uiState.selectAccount(accountId);
  uiState.selectSmartView("unread");
  uiState.closeSettings();
  uiState.showToast(t("account.setup_complete"));
  uiState.clearAccountSetup();
}

export function useAccountDetailSyncControls({
  account,
  queryClient,
  t,
  onSyncStatusChanged,
  accountSetupState,
}: AccountDetailSyncControlsParams): AccountDetailSyncControlsResult {
  const showSyncUpdateError = createAccountDetailErrorToast(t, "account.failed_to_update_sync");
  const showSyncError = createAccountDetailErrorToast(t, "account.sync_failed");
  const syncActionInFlightRef = useRef(false);
  const syncUpdateRevisionRef = useRef(0);
  const [syncActionInFlight, setSyncActionInFlight] = useState(false);

  const handleSyncUpdate = async (partial: UpdateAccountSyncParams) => {
    const revision = syncUpdateRevisionRef.current + 1;
    syncUpdateRevisionRef.current = revision;

    Result.pipe(
      await updateAccountSync(
        account.id,
        partial.syncIntervalSecs ?? account.sync_interval_secs,
        partial.syncOnStartup ?? account.sync_on_startup,
        partial.syncOnWake ?? account.sync_on_wake,
        partial.keepReadItemsDays ?? account.keep_read_items_days,
      ),
      Result.inspectError((error) => {
        if (revision !== syncUpdateRevisionRef.current) {
          return;
        }
        showSyncUpdateError(error);
      }),
      Result.inspect((updated) => {
        if (revision !== syncUpdateRevisionRef.current) {
          return;
        }
        updateCachedAccount(queryClient, updated);
      }),
    );
  };

  const handleSyncNow = async () => {
    if (syncActionInFlightRef.current) {
      return;
    }

    syncActionInFlightRef.current = true;
    setSyncActionInFlight(true);
    try {
      const result = await syncAccount(account.id);
      Result.pipe(
        result,
        Result.inspect((syncResult) => {
          invalidateFeedQueries(queryClient, { includeFolders: false });
          invalidateQueryKeysLogOnly(queryClient, [queryKeys.articles.root]);
          onSyncStatusChanged?.();
          useUiStore.getState().showToast(
            resolveSyncFeedbackMessage(summarizeSyncResult(syncResult), {
              alreadyInProgress: t("account.syncing_now"),
              partialFailure: (accounts) => t("account.sync_failed", { message: accounts }),
              retryScheduled: () => t("account.sync_completed_with_retry_pending"),
              retryPending: () => t("account.sync_completed_with_retry_pending"),
              warnings: () => t("account.sync_completed_with_warnings"),
              success: t("account.sync_complete"),
            }),
          );
        }),
        Result.inspectError(showSyncError),
      );
    } finally {
      syncActionInFlightRef.current = false;
      setSyncActionInFlight(false);
    }
  };

  const handleSetupRetry = async () => {
    if (accountSetupState === null || syncActionInFlightRef.current) {
      return;
    }

    syncActionInFlightRef.current = true;
    setSyncActionInFlight(true);
    try {
      await runAccountSetupSync({
        accountId: account.id,
        queryClient,
        t,
        onSyncStatusChanged,
      });
    } finally {
      syncActionInFlightRef.current = false;
      setSyncActionInFlight(false);
    }
  };

  return {
    handleSyncUpdate,
    handleSyncNow,
    handleSetupRetry,
    syncActionInFlight,
    syncIntervalOptions: [
      { value: "900", label: t("account.every_15_minutes") },
      { value: "1800", label: t("account.every_30_minutes") },
      { value: "3600", label: t("account.every_hour") },
      { value: "7200", label: t("account.every_2_hours") },
      { value: "14400", label: t("account.every_4_hours") },
      { value: "86400", label: t("account.once_a_day") },
    ],
    keepReadItemsOptions: [
      { value: "7", label: t("account.one_week") },
      { value: "14", label: t("account.two_weeks") },
      { value: "30", label: t("account.one_month") },
      { value: "60", label: t("account.sixty_days") },
      { value: "90", label: t("account.three_months") },
      { value: "180", label: t("account.six_months") },
      { value: "365", label: t("account.one_year") },
      { value: "0", label: t("account.forever") },
    ],
  };
}
