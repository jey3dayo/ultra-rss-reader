import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { AccountCredentialsSectionView } from "@/components/settings/account-detail/credentials-section-view";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import { isFreshRssAccount } from "./account-kind";
import type { AccountDetailControllerResult } from "./use-account-detail-controller";

type BuildCredentialsSectionParams = {
  account: AccountDetailAccount;
  controller: AccountDetailControllerResult;
  t: TFunction<"settings">;
  verificationStatus: NonNullable<AccountDetailAccount["connection_verification_status"]>;
  isSetupSyncing: boolean;
  isSetupFailed: boolean;
  isSetupActive: boolean;
  isQuarantined: boolean;
};

export function buildCredentialsSection({
  account,
  controller,
  t,
  verificationStatus,
  isSetupSyncing,
  isSetupFailed,
  isQuarantined,
}: BuildCredentialsSectionParams): ReactNode {
  if (!isFreshRssAccount(account)) {
    return undefined;
  }

  const cloudflareAccessError = controller.cloudflareAccessValidationError;

  return (
    <AccountCredentialsSectionView
      heading={t("account.server")}
      note={
        isQuarantined
          ? t("account.quarantine_readonly_note")
          : isSetupFailed
            ? t("account.setup_failed_credentials_note")
            : undefined
      }
      disabled={isSetupSyncing || isQuarantined}
      serverUrlLabel={t("account.server_url")}
      serverUrlValue={controller.credServerUrl ?? account.server_url ?? ""}
      serverUrlPlaceholder={t("account.server_url_placeholder")}
      serverUrlErrorText={
        cloudflareAccessError === "https_required" ? t("account.error_cloudflare_access_https_required") : undefined
      }
      serverUrlInputRef={controller.serverUrlInputRef}
      serverUrlCopyLabel={t("account.copy_server_url")}
      onServerUrlChange={controller.setCredServerUrl}
      onServerUrlCopy={() => void controller.handleCopyServerUrl()}
      usernameLabel={t("account.username")}
      usernameValue={controller.credUsername ?? account.username ?? ""}
      usernameInputRef={controller.usernameInputRef}
      onUsernameChange={controller.setCredUsername}
      passwordLabel={t("account.password")}
      passwordValue={controller.passwordDisplayValue}
      passwordPlaceholder={t("account.password_placeholder")}
      onPasswordChange={controller.setCredPassword}
      onPasswordFocus={controller.onPasswordFocus}
      onPasswordBlur={controller.onPasswordBlur}
      cloudflareAccess={{
        status: controller.cloudflareAccessStatus,
        recoveryAction: controller.cloudflareAccessRecoveryAction,
        onRecoveryActionChange: controller.setCloudflareAccessRecoveryAction,
        loadingMessage: t("account.cloudflare_access_loading"),
        readErrorMessage: t("account.cloudflare_access_read_failed"),
        unavailableMessage: t("account.cloudflare_access_unavailable"),
        label: t("account.cloudflare_access"),
        description: t("account.cloudflare_access_description"),
        enabled: controller.cloudflareAccessEnabled,
        onEnabledChange: controller.setCloudflareAccessEnabled,
        clientId: {
          label: t("account.cloudflare_access_client_id"),
          value: controller.cloudflareAccessClientId,
          placeholder: t("account.cloudflare_access_client_id_placeholder"),
          onChange: controller.setCloudflareAccessClientId,
        },
        clientSecret: {
          label: t("account.cloudflare_access_secret"),
          value: controller.cloudflareAccessSecret,
          placeholder: t("account.cloudflare_access_secret_placeholder"),
          onChange: controller.setCloudflareAccessSecret,
        },
        clientIdError: t("account.error_cloudflare_access_client_id_required"),
        clientSecretError: t("account.error_cloudflare_access_secret_required"),
        validationError: cloudflareAccessError,
      }}
      testConnectionLabel={
        isSetupSyncing || isQuarantined
          ? undefined
          : controller.dirtyState.dirty
            ? t("account.save_and_test_connection")
            : t("account.test_connection")
      }
      testingConnectionLabel={isSetupSyncing || isQuarantined ? undefined : t("account.testing_connection")}
      testConnectionTone={verificationStatus === "verified" ? "subtle" : "content"}
      onTestConnection={isSetupSyncing || isQuarantined ? undefined : controller.handleTestConnection}
      isTestingConnection={controller.testingConnection}
    />
  );
}
