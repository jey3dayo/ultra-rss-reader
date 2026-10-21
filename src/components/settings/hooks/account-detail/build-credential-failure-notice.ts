import type { TFunction } from "i18next";
import type { CredentialFailureNoticeViewModel } from "@/components/settings/account-detail/credential-failure-notice-view";
import type { CredentialFailureNotice, CredentialStoreKind } from "@/lib/account/credential-failure";
import type { AccountDetailControllerResult } from "./use-account-detail-controller";

type RetryHandlers = Pick<
  AccountDetailControllerResult,
  "retryCloudflareAccessLoad" | "commitCredentials" | "handleTestConnection" | "testingConnection"
>;

function failureLines(notice: CredentialFailureNotice, storeKind: CredentialStoreKind, t: TFunction<"settings">) {
  const store = t(`account.credential_store_name.${storeKind}`);
  const target = t(`account.credential_target.${notice.target}`);
  const lines = [t(`account.credential_failure.${notice.cause}`, { store, target })];
  if (notice.operation === "check_after_save") {
    lines.unshift(t("account.credential_saved_connection_unconfirmed"));
  }
  if (notice.operation === "load") {
    lines.push(t("account.credential_failure_saved_unchanged"));
  }
  if (notice.operation === "save") {
    lines.push(t(`account.credential_failure_save_next.${notice.cause === "unverified" ? "unverified" : "kept"}`));
  }
  return lines;
}

export function buildCredentialFailureNotice(
  notice: CredentialFailureNotice,
  storeKind: CredentialStoreKind,
  t: TFunction<"settings">,
  controller: RetryHandlers,
): CredentialFailureNoticeViewModel {
  const retry = {
    load: () => controller.retryCloudflareAccessLoad(),
    save: () => void controller.commitCredentials(),
    check: () => void controller.handleTestConnection(),
    check_after_save: () => void controller.handleTestConnection(),
  }[notice.operation];
  return {
    lines: failureLines(notice, storeKind, t),
    retryLabel: t(`account.credential_retry.${notice.operation === "check_after_save" ? "check" : notice.operation}`),
    onRetry: retry,
    retryDisabled: controller.testingConnection,
  };
}
