import type { TFunction } from "i18next";
import { formatAccountSyncRetryTime } from "@/lib/account/account-sync-status-format";
import i18n from "@/lib/i18n";
import {
  getSyncWarningDetailTranslationKey,
  resolveSyncFeedbackMessage,
  type SyncFeedback,
} from "@/lib/sync/sync-result-feedback";

export function resolveSidebarSyncFeedbackMessage(t: TFunction<"sidebar">, feedback: SyncFeedback): string {
  return resolveSyncFeedbackMessage(feedback, {
    alreadyInProgress: t("sync_already_in_progress"),
    partialFailure: (accounts) => t("sync_partial_failure", { accounts }),
    retryScheduled: (accounts, retryAt) => {
      const retryTime = formatAccountSyncRetryTime(retryAt, i18n.language);
      return retryTime
        ? t("sync_retry_scheduled", { accounts, time: retryTime })
        : t("sync_retry_scheduled_soon", { accounts });
    },
    retryPending: (accounts) => t("sync_completed_with_retry_pending", { accounts }),
    warnings: (accounts) => t("sync_completed_with_warnings", { accounts }),
    success: t("sync_completed"),
    detailLine: (detail, remainingCount) => {
      const { key, params } = getSyncWarningDetailTranslationKey(detail);
      const detailText = t(`sync_warning_detail.${key}`, params);
      return remainingCount > 0
        ? `${detailText} ${t("sync_warning_detail_more", { count: remainingCount })}`
        : detailText;
    },
  });
}
