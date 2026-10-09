import { Copy } from "lucide-react";
import type { ComponentProps, RefObject } from "react";
import { useTranslation } from "react-i18next";
import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import { CloudflareAccessControl } from "@/components/settings/shared/cloudflare-access-control";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { SETTINGS_CONTROL_SURFACE_CLASS } from "@/components/settings/shared/settings-surface";
import { LabeledControlRow, LabeledInputRow, SurfaceCard } from "@/design-system";
import type { CloudflareAccessDraftError } from "@/lib/account/cloudflare-access";

type AccountCredentialInputRow = {
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "password" | "url";
  onChange: (value: string) => void;
  onBlur: () => void;
  onFocus?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  errorText?: string;
};

type AccountCloudflareAccessSection = {
  status: "loading" | "ready" | "error" | "unavailable";
  recoveryAction?: "replace" | "remove" | null;
  onRecoveryActionChange?: (action: "replace" | "remove") => void;
  loadingMessage: string;
  readErrorMessage: string;
  unavailableMessage: string;
  label: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  clientId: AccountCredentialInputRow;
  clientSecret: AccountCredentialInputRow;
  clientIdError: string;
  clientSecretError: string;
  validationError: CloudflareAccessDraftError | null;
};

const EMPTY_EXTRA_ROWS: AccountCredentialInputRow[] = [];
const CONTROL_RAIL_CLASS = "w-full sm:max-w-[30rem]";

type AccountCredentialsSectionViewProps = {
  heading: string;
  note?: string;
  disabled?: boolean;
  serverUrlLabel?: string;
  serverUrlValue?: string;
  serverUrlPlaceholder?: string;
  serverUrlInputRef?: AccountCredentialInputRow["inputRef"];
  onServerUrlChange?: (value: string) => void;
  onServerUrlBlur?: () => void;
  serverUrlCopyLabel?: string;
  onServerUrlCopy?: () => void;
  serverUrlErrorText?: string;
  usernameLabel: string;
  usernameValue: string;
  usernameInputRef?: AccountCredentialInputRow["inputRef"];
  onUsernameChange: (value: string) => void;
  onUsernameBlur: () => void;
  passwordLabel: string;
  passwordValue: string;
  passwordPlaceholder: string;
  onPasswordChange: (value: string) => void;
  onPasswordFocus?: () => void;
  onPasswordBlur: () => void;
  testConnectionLabel?: string;
  testingConnectionLabel?: string;
  onTestConnection?: () => void;
  isTestingConnection?: boolean;
  testConnectionTone?: ComponentProps<typeof SettingsLoadingActionButton>["tone"];
  extraRows?: AccountCredentialInputRow[];
  cloudflareAccess?: AccountCloudflareAccessSection;
};

export function AccountCredentialsSectionView({
  heading,
  note,
  disabled = false,
  serverUrlLabel,
  serverUrlValue,
  serverUrlPlaceholder,
  serverUrlInputRef,
  onServerUrlChange,
  onServerUrlBlur,
  serverUrlCopyLabel,
  onServerUrlCopy,
  serverUrlErrorText,
  usernameLabel,
  usernameValue,
  usernameInputRef,
  onUsernameChange,
  onUsernameBlur,
  passwordLabel,
  passwordValue,
  passwordPlaceholder,
  onPasswordChange,
  onPasswordFocus,
  onPasswordBlur,
  testConnectionLabel,
  testingConnectionLabel,
  onTestConnection,
  isTestingConnection,
  testConnectionTone,
  extraRows,
  cloudflareAccess,
}: AccountCredentialsSectionViewProps) {
  const { t } = useTranslation("settings");
  const labelColumnClassName = "sm:w-40 sm:shrink-0";
  const resolvedExtraRows = extraRows ?? EMPTY_EXTRA_ROWS;

  return (
    <SettingsSection heading={heading} note={note} surface="flat" className="mb-6 sm:mb-7">
      {serverUrlLabel && onServerUrlChange && (
        <LabeledInputRow
          label={serverUrlLabel}
          name="server-url"
          type="url"
          value={serverUrlValue ?? ""}
          placeholder={serverUrlPlaceholder}
          inputRef={serverUrlInputRef}
          onChange={onServerUrlChange}
          onBlur={!disabled ? onServerUrlBlur : undefined}
          labelClassName={labelColumnClassName}
          inputClassName={`h-11 ${SETTINGS_CONTROL_SURFACE_CLASS}`}
          errorText={serverUrlErrorText}
          actionLabel={serverUrlCopyLabel}
          actionAriaLabel={serverUrlCopyLabel}
          actionTooltipLabel={serverUrlCopyLabel}
          actionIcon={<Copy className="size-3.5" />}
          actionPlacement="inside"
          actionVariant="ghost"
          actionSize="icon-sm"
          onAction={onServerUrlCopy}
          actionDisabled={disabled || !serverUrlValue}
          disabled={disabled}
        />
      )}
      {resolvedExtraRows.map((row) => (
        <LabeledInputRow
          key={row.label}
          label={row.label}
          type={row.type}
          value={row.value}
          inputRef={row.inputRef}
          onChange={row.onChange}
          onFocus={!disabled ? row.onFocus : undefined}
          onBlur={!disabled ? row.onBlur : undefined}
          placeholder={row.placeholder}
          labelClassName={labelColumnClassName}
          inputClassName={`h-11 ${SETTINGS_CONTROL_SURFACE_CLASS}`}
          disabled={disabled}
        />
      ))}
      <LabeledInputRow
        label={usernameLabel}
        value={usernameValue}
        inputRef={usernameInputRef}
        onChange={onUsernameChange}
        onBlur={!disabled ? onUsernameBlur : undefined}
        labelClassName={labelColumnClassName}
        inputClassName={`h-11 ${SETTINGS_CONTROL_SURFACE_CLASS}`}
        disabled={disabled}
      />
      <LabeledInputRow
        label={passwordLabel}
        type="password"
        value={passwordValue}
        onChange={onPasswordChange}
        onFocus={!disabled ? onPasswordFocus : undefined}
        onBlur={!disabled ? onPasswordBlur : undefined}
        placeholder={passwordPlaceholder}
        labelClassName={labelColumnClassName}
        inputClassName={`h-11 ${SETTINGS_CONTROL_SURFACE_CLASS}`}
        disabled={disabled}
      />
      {cloudflareAccess?.status === "loading" && (
        <p className="text-sm text-foreground-soft" role="status">
          {cloudflareAccess.loadingMessage}
        </p>
      )}
      {cloudflareAccess?.status === "error" && (
        <SurfaceCard variant="info" tone="danger" padding="compact" role="alert">
          <p className="text-sm leading-[1.5]">{cloudflareAccess.readErrorMessage}</p>
          {cloudflareAccess.onRecoveryActionChange && (
            <div className="mt-3 flex flex-wrap gap-2">
              <SettingsActionButton
                type="button"
                size="compact"
                disabled={disabled}
                aria-pressed={cloudflareAccess.recoveryAction === "replace"}
                onClick={() => cloudflareAccess.onRecoveryActionChange?.("replace")}
              >
                {t("account.cloudflare_access_reconfigure")}
              </SettingsActionButton>
              <SettingsActionButton
                type="button"
                tone="danger"
                size="compact"
                disabled={disabled}
                aria-pressed={cloudflareAccess.recoveryAction === "remove"}
                onClick={() => cloudflareAccess.onRecoveryActionChange?.("remove")}
              >
                {t("account.cloudflare_access_remove")}
              </SettingsActionButton>
            </div>
          )}
          {cloudflareAccess.recoveryAction === "remove" && (
            <p className="mt-2 text-sm leading-[1.5]">{t("account.cloudflare_access_remove_on_save")}</p>
          )}
        </SurfaceCard>
      )}
      {cloudflareAccess?.status === "unavailable" && (
        <SurfaceCard variant="info" tone="subtle" padding="compact" role="status">
          <p className="text-sm leading-[1.5]">{cloudflareAccess.unavailableMessage}</p>
        </SurfaceCard>
      )}
      {cloudflareAccess && (cloudflareAccess.status === "ready" || cloudflareAccess.status === "error") && (
        <>
          {cloudflareAccess.status === "ready" && (
            <CloudflareAccessControl
              mode="detail"
              label={cloudflareAccess.label}
              description={cloudflareAccess.description}
              checked={cloudflareAccess.enabled}
              onChange={cloudflareAccess.onEnabledChange}
              disabled={disabled}
              labelClassName={labelColumnClassName}
            />
          )}
          {(cloudflareAccess.status === "ready"
            ? cloudflareAccess.enabled
            : cloudflareAccess.recoveryAction === "replace") && (
            <>
              <LabeledInputRow
                label={cloudflareAccess.clientId.label}
                name="cloudflare-access-client-id"
                type="text"
                value={cloudflareAccess.clientId.value}
                onChange={cloudflareAccess.clientId.onChange}
                onBlur={!disabled ? cloudflareAccess.clientId.onBlur : undefined}
                placeholder={cloudflareAccess.clientId.placeholder}
                labelClassName={labelColumnClassName}
                inputClassName={`h-11 ${SETTINGS_CONTROL_SURFACE_CLASS}`}
                disabled={disabled}
                errorText={
                  cloudflareAccess.validationError === "client_id_required" ? cloudflareAccess.clientIdError : undefined
                }
              />
              <LabeledInputRow
                label={cloudflareAccess.clientSecret.label}
                name="cloudflare-access-client-secret"
                type="password"
                value={cloudflareAccess.clientSecret.value}
                onChange={cloudflareAccess.clientSecret.onChange}
                onBlur={!disabled ? cloudflareAccess.clientSecret.onBlur : undefined}
                onFocus={!disabled ? cloudflareAccess.clientSecret.onFocus : undefined}
                placeholder={cloudflareAccess.clientSecret.placeholder}
                labelClassName={labelColumnClassName}
                inputClassName={`h-11 ${SETTINGS_CONTROL_SURFACE_CLASS}`}
                disabled={disabled}
                errorText={
                  cloudflareAccess.validationError === "client_secret_required"
                    ? cloudflareAccess.clientSecretError
                    : undefined
                }
              />
            </>
          )}
        </>
      )}
      {onTestConnection && (
        <LabeledControlRow label={testConnectionLabel ?? ""} labelClassName={labelColumnClassName}>
          <div className={`${CONTROL_RAIL_CLASS} flex justify-end`}>
            <SettingsLoadingActionButton
              tone={testConnectionTone}
              size="standalone"
              onClick={onTestConnection}
              loading={isTestingConnection}
              loadingLabel={testingConnectionLabel}
              disabled={disabled}
            >
              {testConnectionLabel}
            </SettingsLoadingActionButton>
          </div>
        </LabeledControlRow>
      )}
    </SettingsSection>
  );
}
