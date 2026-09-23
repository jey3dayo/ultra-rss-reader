import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import type { AccountSyncStatusDto } from "@/api/tauri-commands";
import { AccountConnectionSummary } from "@/components/settings/account-connection-summary";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import { formatAccountLastSuccessLabel } from "@/lib/account/account-sync-status-format";

type BuildHeaderSummaryParams = {
  account: AccountDetailAccount;
  verificationStatus: NonNullable<AccountDetailAccount["connection_verification_status"]>;
  syncStatus: AccountSyncStatusDto | undefined;
  language: string;
  t: TFunction<"settings">;
};

export function buildHeaderSummary({
  account,
  verificationStatus,
  syncStatus,
  language,
  t,
}: BuildHeaderSummaryParams): ReactNode {
  if (account.kind !== "FreshRss") {
    return undefined;
  }

  const lastSuccessLabel = formatAccountLastSuccessLabel(syncStatus?.last_success_at ?? undefined, language);
  const summaryDetail = lastSuccessLabel
    ? lastSuccessLabel.isToday
      ? t("account.synced_today_at", { time: lastSuccessLabel.time })
      : t("account.synced_date_at", {
          date: lastSuccessLabel.date,
          time: lastSuccessLabel.time,
        })
    : verificationStatus === "error"
      ? t("account.connection_auth_failed_summary")
      : syncStatus?.last_error
        ? t("account.connection_fetch_failed_summary")
        : t("account.connection_not_fetched_summary");

  return (
    <AccountConnectionSummary
      statusLabel={
        verificationStatus === "verified"
          ? t("account.connection_verified_status")
          : verificationStatus === "error"
            ? t("account.connection_error_status")
            : t("account.connection_unverified_status")
      }
      statusTone={verificationStatus === "verified" ? "success" : verificationStatus === "error" ? "danger" : "warning"}
      detail={summaryDetail}
    />
  );
}
