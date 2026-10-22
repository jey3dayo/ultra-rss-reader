import type { TFunction } from "i18next";
import { useMemo } from "react";
import type { AccountSyncStatusDto } from "@/api/tauri-commands";
import type { AccountSyncStatusRow } from "@/components/settings/account-detail/sync-section-view";
import {
  formatAccountLastSuccessLabel,
  formatAccountSyncRetryDateTime,
  getAccountSyncErrorTranslationKey,
} from "@/lib/account/account-sync-status-format";

type AccountDetailSyncStatusTranslator =
  | TFunction<"settings">
  | ((key: string, options?: { count?: number; message?: string; date?: string; time?: string }) => string);

type AccountDetailSyncStatusRowsParams = {
  syncStatus: AccountSyncStatusDto | undefined;
  language: string;
  t: AccountDetailSyncStatusTranslator;
};

type AccountDetailSyncStatusRowsResult = AccountSyncStatusRow[];

export function useAccountDetailSyncStatusRows({
  syncStatus,
  language,
  t,
}: AccountDetailSyncStatusRowsParams): AccountDetailSyncStatusRowsResult {
  return useMemo(() => {
    if (!syncStatus) {
      return [];
    }

    const rows: AccountDetailSyncStatusRowsResult = [];

    const lastSuccess = formatAccountLastSuccessLabel(syncStatus.last_success_at ?? undefined, language);
    if (lastSuccess) {
      rows.push({
        label: t("account.last_sync_success"),
        value: lastSuccess.isToday
          ? t("account.synced_today_at", { time: lastSuccess.time })
          : t("account.synced_date_at", { date: lastSuccess.date, time: lastSuccess.time }),
      });
    }

    if (syncStatus.waiting_for_credential_access) {
      rows.push({
        label: t("account.automatic_sync_status"),
        value: t("account.automatic_sync_paused_needs_connection_test"),
      });
    } else if (syncStatus.next_retry_at) {
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
      const { key, params } = getAccountSyncErrorTranslationKey(syncStatus.last_error);
      rows.push({
        label: t("account.last_sync_error"),
        value: key === null ? syncStatus.last_error : t(`account.sync_error_detail.${key}`, params),
      });
    }

    return rows;
  }, [language, syncStatus, t]);
}
