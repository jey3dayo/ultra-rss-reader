import { useTranslation } from "react-i18next";
import { CloudflareAccessControl } from "@/components/settings/shared/cloudflare-access-control";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SETTINGS_CONTROL_SURFACE_CLASS } from "@/components/settings/shared/settings-surface";
import { LabeledInputRow, SurfaceCard } from "@/design-system";
import type { AccountCloudflareAccessSection } from "./credentials-section-view.types";

type CloudflareAccessCredentialFieldsProps = {
  section: AccountCloudflareAccessSection;
  disabled: boolean;
  labelClassName: string;
};

function CloudflareAccessRecoveryCard({
  section,
  disabled,
}: {
  section: AccountCloudflareAccessSection;
  disabled: boolean;
}) {
  const { t } = useTranslation("settings");
  const { onRecoveryActionChange, recoveryAction } = section;

  return (
    <SurfaceCard variant="info" tone="danger" padding="compact" role="alert">
      <p className="text-sm leading-[1.5]">{section.readErrorMessage}</p>
      {onRecoveryActionChange && (
        <div className="mt-3 flex flex-wrap gap-2">
          <SettingsActionButton
            type="button"
            size="compact"
            disabled={disabled}
            aria-pressed={recoveryAction === "replace"}
            onClick={() => onRecoveryActionChange("replace")}
          >
            {t("account.cloudflare_access_reconfigure")}
          </SettingsActionButton>
          <SettingsActionButton
            type="button"
            tone="danger"
            size="compact"
            disabled={disabled}
            aria-pressed={recoveryAction === "remove"}
            onClick={() => onRecoveryActionChange("remove")}
          >
            {t("account.cloudflare_access_remove")}
          </SettingsActionButton>
        </div>
      )}
      {recoveryAction === "remove" && (
        <p className="mt-2 text-sm leading-[1.5]">{t("account.cloudflare_access_remove_on_save")}</p>
      )}
    </SurfaceCard>
  );
}

function CloudflareAccessInputRows({ section, disabled, labelClassName }: CloudflareAccessCredentialFieldsProps) {
  const { clientId, clientSecret, validationError } = section;

  return (
    <>
      <LabeledInputRow
        label={clientId.label}
        name="cloudflare-access-client-id"
        type="text"
        value={clientId.value}
        onChange={clientId.onChange}
        onBlur={!disabled ? clientId.onBlur : undefined}
        placeholder={clientId.placeholder}
        labelClassName={labelClassName}
        inputClassName={`h-11 ${SETTINGS_CONTROL_SURFACE_CLASS}`}
        disabled={disabled}
        errorText={validationError === "client_id_required" ? section.clientIdError : undefined}
      />
      <LabeledInputRow
        label={clientSecret.label}
        name="cloudflare-access-client-secret"
        type="password"
        value={clientSecret.value}
        onChange={clientSecret.onChange}
        onBlur={!disabled ? clientSecret.onBlur : undefined}
        onFocus={!disabled ? clientSecret.onFocus : undefined}
        placeholder={clientSecret.placeholder}
        labelClassName={labelClassName}
        inputClassName={`h-11 ${SETTINGS_CONTROL_SURFACE_CLASS}`}
        disabled={disabled}
        errorText={validationError === "client_secret_required" ? section.clientSecretError : undefined}
      />
    </>
  );
}

export function CloudflareAccessCredentialFields({
  section,
  disabled,
  labelClassName,
}: CloudflareAccessCredentialFieldsProps) {
  const { status } = section;

  if (status === "loading") {
    return (
      <p className="text-sm text-foreground-soft" role="status">
        {section.loadingMessage}
      </p>
    );
  }

  if (status === "unavailable") {
    return (
      <SurfaceCard variant="info" tone="subtle" padding="compact" role="status">
        <p className="text-sm leading-[1.5]">{section.unavailableMessage}</p>
      </SurfaceCard>
    );
  }

  const showInputRows = status === "ready" ? section.enabled : section.recoveryAction === "replace";

  return (
    <>
      {status === "error" && <CloudflareAccessRecoveryCard section={section} disabled={disabled} />}
      {status === "ready" && (
        <CloudflareAccessControl
          mode="detail"
          label={section.label}
          description={section.description}
          checked={section.enabled}
          onChange={section.onEnabledChange}
          disabled={disabled}
          labelClassName={labelClassName}
        />
      )}
      {showInputRows && (
        <CloudflareAccessInputRows section={section} disabled={disabled} labelClassName={labelClassName} />
      )}
    </>
  );
}
