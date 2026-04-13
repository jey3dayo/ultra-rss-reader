import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAccountSyncStatuses } from "@/hooks/use-account-sync-statuses";
import { formatAccountSyncRetryTime } from "@/lib/account-sync-status-format";
import type { SidebarAccountStatusLabelsParams } from "./sidebar-sources.types";

export function useSidebarAccountStatusLabels(accounts: SidebarAccountStatusLabelsParams) {
  const { t, i18n } = useTranslation("sidebar");
  const accountSyncStatuses = useAccountSyncStatuses(accounts);

  return useMemo(
    () =>
      Object.fromEntries(
        (accounts ?? []).flatMap((account) => {
          const syncStatus = accountSyncStatuses[account.id];
          if (!syncStatus?.next_retry_at) {
            return [];
          }

          const retryTime = formatAccountSyncRetryTime(syncStatus.next_retry_at, i18n.language);
          return [
            [
              account.id,
              retryTime
                ? t("account_retry_scheduled_short", { time: retryTime })
                : t("account_retry_scheduled_short_soon"),
            ],
          ];
        }),
      ),
    [accountSyncStatuses, accounts, i18n.language, t],
  );
}
