import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import { AccountCredentialsSectionView } from "@/components/settings/account-detail/credentials-section-view";
import type { AccountDetailAccount } from "@/components/settings/account-detail/types";
import { ChangedFieldIndicator } from "@/components/settings/shared/changed-field-indicator";
import type { CredentialStoreKind } from "@/lib/account/credential-failure";
import { isFreshRssAccount } from "./account-kind";
import { buildCredentialFailureNotice } from "./build-credential-failure-notice";
import type { AccountDetailControllerResult } from "./use-account-detail-controller";

type BuildCredentialsSectionParams = {
  account: AccountDetailAccount;
  controller: AccountDetailControllerResult;
  t: TFunction<"settings">;
  isSetupSyncing: boolean;
  isSetupFailed: boolean;
  isSetupActive: boolean;
  isQuarantined: boolean;
  credentialStoreKind: CredentialStoreKind;
};

export function buildCredentialsSection({
  account,
  controller,
  t,
  isSetupSyncing,
  isSetupFailed,
  isQuarantined,
  credentialStoreKind,
}: BuildCredentialsSectionParams): ReactNode {
  if (!isFreshRssAccount(account)) {
    return undefined;
  }

  const cloudflareAccessError = controller.cloudflareAccessValidationError;
  const failure =
    controller.credentialFailure ??
    (controller.cloudflareAccessStatus === "error"
      ? ({ target: "cloudflare_access", cause: "read_failed", operation: "load" } as const)
      : null);
  const failureNotice =
    failure === null ? undefined : buildCredentialFailureNotice(failure, credentialStoreKind, t, controller);

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
      passwordFailureNotice={failure?.target === "password" ? failureNotice : undefined}
      onPasswordChange={controller.setCredPassword}
      onPasswordFocus={controller.onPasswordFocus}
      onPasswordBlur={controller.onPasswordBlur}
      changedFields={controller.changedFields}
      changedFieldLabel={t("dirty_state.field_changed")}
      cloudflareAccess={{
        status: controller.cloudflareAccessStatus,
        changedIndicator: controller.changedFields.cloudflareAccess ? (
          <ChangedFieldIndicator label={t("dirty_state.field_changed")} />
        ) : undefined,
        hasSavedSecret: controller.cloudflareAccessHasSavedSecret,
        secretEditing: controller.cloudflareAccessSecretEditing,
        secretVisible: controller.cloudflareAccessSecretVisible,
        secretDescription: t("account.cloudflare_access_secret_description"),
        secretSavedLabel: t("account.cloudflare_access_secret_saved"),
        secretChangeLabel: t("account.cloudflare_access_secret_change"),
        secretChangeAriaLabel: t("account.cloudflare_access_secret_change_aria"),
        secretCancelLabel: t("account.cloudflare_access_secret_cancel"),
        secretShowLabel: t("account.cloudflare_access_secret_show"),
        secretHideLabel: t("account.cloudflare_access_secret_hide"),
        onSecretEditingChange: controller.setCloudflareAccessSecretEditing,
        onSecretVisibilityChange: controller.setCloudflareAccessSecretVisible,
        recoveryAction: controller.cloudflareAccessRecoveryAction,
        onRecoveryActionChange: controller.setCloudflareAccessRecoveryAction,
        loadingMessage: t("account.cloudflare_access_loading"),
        failureNotice: failure?.target === "cloudflare_access" ? failureNotice : undefined,
        unavailableMessage: t("account.cloudflare_access_unavailable"),
        authorizationRequiredMessage: t("account.cloudflare_access_authorization_required"),
        label: t("account.cloudflare_access"),
        description: t("account.cloudflare_access_description"),
        enabled: controller.cloudflareAccessEnabled,
        onEnabledChange: controller.setCloudflareAccessEnabled,
        changedFieldLabel: t("dirty_state.field_changed"),
        clientId: {
          label: t("account.cloudflare_access_client_id"),
          value: controller.cloudflareAccessClientId,
          placeholder: t("account.cloudflare_access_client_id_placeholder"),
          onChange: controller.setCloudflareAccessClientId,
          changed: controller.changedFields.cloudflareAccessClientId,
        },
        clientSecret: {
          label: t("account.cloudflare_access_secret"),
          value: controller.cloudflareAccessSecret,
          placeholder: t("account.cloudflare_access_secret_placeholder"),
          onChange: controller.setCloudflareAccessSecret,
          changed: controller.changedFields.cloudflareAccessSecret,
        },
        clientIdError: t("account.error_cloudflare_access_client_id_required"),
        clientSecretError: t("account.error_cloudflare_access_secret_required"),
        validationError: cloudflareAccessError,
      }}
    />
  );
}
