import type { TFunction } from "i18next";
import { useMemo } from "react";
import type { AccountSyncStatusDto } from "@/api/tauri-commands";
import { formatAccountSyncRetryDateTime } from "@/lib/account/account-sync-status-format";
import type { AccountSyncStatusRow } from "../../account-detail/sync.types";

type AccountDetailSyncStatusTranslator =
  | TFunction<"settings">
  | ((key: string, options?: { count?: number }) => string);

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
