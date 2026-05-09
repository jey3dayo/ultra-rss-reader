import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAccountSyncStatuses } from "@/hooks/use-account-sync-statuses";
import { formatAccountSyncRetryTime } from "@/lib/account/account-sync-status-format";
import type { SidebarAccountStatusLabelsParams } from "../../sidebar-sources.types";

export function buildSidebarAccountStatusLabels(params: {
  accounts: SidebarAccountStatusLabelsParams;
  accountSyncStatuses: Record<string, { last_error?: string | null; next_retry_at?: string | null } | undefined>;
  language: string;
  labels: {
    scheduledAt: (time: string) => string;
    scheduledSoon: string;
  };
}): Record<string, string> {
  const { accounts, accountSyncStatuses, language, labels } = params;
  const seenAccountIds = new Set<string>();
  const accountStatusLabels: Record<string, string> = {};

  for (const account of accounts ?? []) {
    if (account.id.trim().length === 0 || seenAccountIds.has(account.id)) {
      continue;
    }
    seenAccountIds.add(account.id);

    const syncStatus = accountSyncStatuses[account.id];
    if (!syncStatus?.next_retry_at) {
      continue;
    }

    const retryTime = formatAccountSyncRetryTime(syncStatus.next_retry_at, language);
    accountStatusLabels[account.id] = retryTime ? labels.scheduledAt(retryTime) : labels.scheduledSoon;
  }

  return accountStatusLabels;
}

export function useSidebarAccountStatusLabels(accounts: SidebarAccountStatusLabelsParams) {
  const { t, i18n } = useTranslation("sidebar");
  const accountSyncStatuses = useAccountSyncStatuses(accounts);

  return useMemo(
    () =>
      buildSidebarAccountStatusLabels({
        accounts,
        accountSyncStatuses,
        language: i18n.language,
        labels: {
          scheduledAt: (time) => t("account_retry_scheduled_short", { time }),
          scheduledSoon: t("account_retry_scheduled_short_soon"),
        },
      }),
    [accountSyncStatuses, accounts, i18n.language, t],
  );
}
