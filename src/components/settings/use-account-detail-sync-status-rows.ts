import { useMemo } from "react";
import { formatAccountSyncRetryDateTime } from "@/lib/account-sync-status-format";
import type {
  UseAccountDetailSyncStatusRowsParams,
  UseAccountDetailSyncStatusRowsResult,
} from "./account-detail.types";

export function useAccountDetailSyncStatusRows({
  syncStatus,
  language,
  t,
}: UseAccountDetailSyncStatusRowsParams): UseAccountDetailSyncStatusRowsResult {
  return useMemo(() => {
    if (!syncStatus) {
      return [];
    }

    const rows: UseAccountDetailSyncStatusRowsResult = [];

    if (syncStatus.next_retry_at) {
      const formattedRetryAt = formatAccountSyncRetryDateTime(syncStatus.next_retry_at, language);
      rows.push({ label: t("account.next_automatic_retry"), value: formattedRetryAt ?? syncStatus.next_retry_at });
    }

    if (syncStatus.error_count > 0) {
      rows.push({
        label: t("account.consecutive_sync_failures"),
        value: t("account.consecutive_sync_failures_value", { count: syncStatus.error_count }),
      });
    }

    if (syncStatus.last_error) {
      rows.push({ label: t("account.last_sync_error"), value: syncStatus.last_error });
    }

    return rows;
  }, [language, syncStatus, t]);
}
