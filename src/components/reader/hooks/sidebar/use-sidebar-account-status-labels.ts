import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAccountSyncStatuses } from "@/hooks/use-account-sync-statuses";
import { useRetryClock } from "@/hooks/use-retry-clock";
import { formatAccountSyncRetryDateTime, getFutureAccountSyncRetry } from "@/lib/account/account-sync-status-format";
import type { SidebarAccountStatusLabelsParams } from "../../sidebar-sources.types";

export function buildSidebarAccountStatusLabels(params: {
  accounts: SidebarAccountStatusLabelsParams;
  accountSyncStatuses: Record<
    string,
    | { last_error?: string | null; next_retry_at?: string | null; waiting_for_credential_access?: boolean | null }
    | undefined
  >;
  language: string;
  now?: number;
  labels: {
    scheduledAt: (time: string) => string;
  };
}): Record<string, string> {
  const { accounts, accountSyncStatuses, language, labels, now = Date.now() } = params;
  const seenAccountIds = new Set<string>();
  const accountStatusLabels: Record<string, string> = {};

  for (const account of accounts ?? []) {
    if (account.id.trim().length === 0 || seenAccountIds.has(account.id)) {
      continue;
    }
    seenAccountIds.add(account.id);

    const syncStatus = accountSyncStatuses[account.id];
    if (getFutureAccountSyncRetry(syncStatus, now) === null) {
      continue;
    }

    const retryTime = formatAccountSyncRetryDateTime(syncStatus?.next_retry_at ?? undefined, language);
    if (retryTime) accountStatusLabels[account.id] = labels.scheduledAt(retryTime);
  }

  return accountStatusLabels;
}

export function useSidebarAccountStatusLabels(accounts: SidebarAccountStatusLabelsParams) {
  const { t, i18n } = useTranslation("sidebar");
  const accountSyncStatuses = useAccountSyncStatuses(accounts);
  const now = useRetryClock(Object.values(accountSyncStatuses));

  return useMemo(
    () =>
      buildSidebarAccountStatusLabels({
        accounts,
        accountSyncStatuses,
        now,
        language: i18n.language,
        labels: {
          scheduledAt: (time) => t("account_retry_scheduled_short", { time }),
        },
      }),
    [accountSyncStatuses, accounts, i18n.language, now, t],
  );
}
