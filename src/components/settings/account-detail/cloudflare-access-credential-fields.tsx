import { cn } from "cn";
import { Eye, EyeOff } from "lucide-react";
import type { ReactNode, RefObject } from "react";
import { useId, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChangedFieldIndicator } from "@/components/settings/shared/changed-field-indicator";
import { CloudflareAccessControl } from "@/components/settings/shared/cloudflare-access-control";
import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import {
  SETTINGS_CHANGED_CONTROL_CLASS,
  SETTINGS_CONTROL_SURFACE_CLASS,
} from "@/components/settings/shared/settings-surface";
import { LabeledControlRow, LabeledInputRow, SurfaceCard } from "@/design-system";
import type { CloudflareAccessDraftError, CloudflareAccessStatus } from "@/lib/account/cloudflare-access";
import {
  CredentialFailureNoticeBody,
  CredentialFailureNoticeView,
  type CredentialFailureNoticeViewModel,
} from "./credential-failure-notice-view";

export type AccountCredentialInputRow = {
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "password" | "url";
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  errorText?: string;
  changed?: boolean;
};

export type AccountCloudflareAccessSection = {
  status: CloudflareAccessStatus;
  changedIndicator?: ReactNode;
  changedFieldLabel?: string;
  hasSavedSecret: boolean;
  secretEditing: boolean;
  secretVisible: boolean;
  secretDescription: string;
  secretSavedLabel: string;
  secretChangeLabel: string;
  secretChangeAriaLabel: string;
  secretCancelLabel: string;
  secretShowLabel: string;
  secretHideLabel: string;
  onSecretEditingChange: (editing: boolean) => void;
  onSecretVisibilityChange: (visible: boolean) => void;
  recoveryAction?: "replace" | "remove" | null;
  onRecoveryActionChange?: (action: "replace" | "remove") => void;
  loadingMessage: string;
  failureNotice?: CredentialFailureNoticeViewModel;
  unavailableMessage: string;
  authorizationRequiredMessage: string;
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

type CloudflareAccessCredentialFieldsProps = {
  section: AccountCloudflareAccessSection;
  disabled: boolean;
  labelClassName: string;
};

function changedInputClassName(changed: boolean | undefined): string {
  return changed
    ? cn("h-11", SETTINGS_CONTROL_SURFACE_CLASS, SETTINGS_CHANGED_CONTROL_CLASS)
    : `h-11 ${SETTINGS_CONTROL_SURFACE_CLASS}`;
}

function changedLabelAccessory(changed: boolean | undefined, changedFieldLabel: string | undefined): ReactNode {
  return changed === true && changedFieldLabel ? <ChangedFieldIndicator label={changedFieldLabel} /> : undefined;
}

function CloudflareAccessRecoveryActions({
  section,
  disabled,
}: {
  section: AccountCloudflareAccessSection;
  disabled: boolean;
}) {
  const { t } = useTranslation("settings");
  const { onRecoveryActionChange, recoveryAction } = section;

  if (!onRecoveryActionChange) return null;

  return (
    <>
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
    </>
  );
}

function CloudflareAccessRecoveryCard({
  section,
  disabled,
}: {
  section: AccountCloudflareAccessSection;
  disabled: boolean;
}) {
  const { t } = useTranslation("settings");

  return (
    <SurfaceCard variant="info" tone="danger" padding="compact" role="alert">
      {section.failureNotice && <CredentialFailureNoticeBody notice={section.failureNotice} />}
      {section.onRecoveryActionChange && (
        <div className="mt-3 flex flex-wrap gap-2">
          <CloudflareAccessRecoveryActions section={section} disabled={disabled} />
        </div>
      )}
      {section.recoveryAction === "remove" && (
        <p className="mt-2 text-sm leading-[1.5]">{t("account.cloudflare_access_remove_on_save")}</p>
      )}
    </SurfaceCard>
  );
}

function CloudflareAccessAuthorizationRequired({
  section,
  disabled,
  labelClassName,
}: CloudflareAccessCredentialFieldsProps) {
  const { t } = useTranslation("settings");

  return (
    <>
      <CloudflareAccessControl
        mode="detail"
        label={section.label}
        description={section.description}
        labelIndicator={section.changedIndicator}
        trailing={<CloudflareAccessRecoveryActions section={section} disabled={disabled} />}
        disabled={disabled}
        labelClassName={labelClassName}
      />
      <p className="text-sm leading-[1.5] text-foreground-soft" role="status">
        {section.authorizationRequiredMessage}
      </p>
      {section.recoveryAction === "remove" && (
        <p className="text-sm leading-[1.5] text-foreground-soft">{t("account.cloudflare_access_remove_on_save")}</p>
      )}
    </>
  );
}

function CloudflareAccessSecretEditor({
  section,
  disabled,
  labelClassName,
  requiresReplacement,
  descriptionId,
  inputRef,
  onCancel,
}: {
  section: AccountCloudflareAccessSection;
  disabled: boolean;
  labelClassName: string;
  requiresReplacement: boolean;
  descriptionId: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onCancel: () => void;
}) {
  const { clientSecret } = section;
  return (
    <>
      <LabeledInputRow
        label={clientSecret.label}
        name="cloudflare-access-client-secret"
        type={section.secretVisible ? "text" : "password"}
        value={clientSecret.value}
        inputRef={inputRef}
        onChange={clientSecret.onChange}
        onBlur={!disabled ? clientSecret.onBlur : undefined}
        onFocus={!disabled ? clientSecret.onFocus : undefined}
        placeholder={clientSecret.placeholder}
        ariaDescribedBy={section.hasSavedSecret ? descriptionId : undefined}
        labelClassName={labelClassName}
        inputClassName={changedInputClassName(clientSecret.changed)}
        labelAccessory={changedLabelAccessory(clientSecret.changed, section.changedFieldLabel)}
        disabled={disabled}
        errorText={requiresReplacement ? section.clientSecretError : undefined}
        actionLabel={section.secretVisible ? section.secretHideLabel : section.secretShowLabel}
        actionAriaLabel={section.secretVisible ? section.secretHideLabel : section.secretShowLabel}
        actionTooltipLabel={section.secretVisible ? section.secretHideLabel : section.secretShowLabel}
        actionIcon={section.secretVisible ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        actionPlacement="inside"
        actionVariant="ghost"
        actionSize="icon-sm"
        actionDisabled={disabled}
        onAction={() => section.onSecretVisibilityChange(!section.secretVisible)}
      />
      {section.hasSavedSecret ? (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(180px,220px)_minmax(0,1fr)] lg:gap-x-8">
          <span aria-hidden="true" className="hidden lg:block" />
          <p
            id={descriptionId}
            className="w-full text-sm leading-[1.5] text-foreground-soft sm:max-w-[30rem] lg:ml-auto lg:mr-2"
          >
            {section.secretDescription}
          </p>
        </div>
      ) : null}
      {section.secretEditing && !requiresReplacement ? (
        <div className="flex justify-end">
          <SettingsActionButton type="button" tone="subtle" size="standalone" disabled={disabled} onClick={onCancel}>
            {section.secretCancelLabel}
          </SettingsActionButton>
        </div>
      ) : null}
    </>
  );
}

function CloudflareAccessSavedSecret({
  section,
  disabled,
  labelClassName,
  buttonRef,
  onChange,
}: {
  section: AccountCloudflareAccessSection;
  disabled: boolean;
  labelClassName: string;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onChange: () => void;
}) {
  return (
    <LabeledControlRow label={section.clientSecret.label} labelClassName={labelClassName}>
      <div className="flex w-full items-center justify-between gap-3 sm:max-w-[30rem]">
        <span className="flex items-center gap-3 text-sm text-foreground-soft">
          <span>{section.secretSavedLabel}</span>
          <span aria-hidden="true" className="font-mono tracking-[0.2em]">
            ••••••••
          </span>
        </span>
        <SettingsActionButton
          type="button"
          tone="subtle"
          size="standalone"
          disabled={disabled}
          aria-label={section.secretChangeAriaLabel}
          ref={buttonRef}
          onClick={onChange}
        >
          {section.secretChangeLabel}
        </SettingsActionButton>
      </div>
    </LabeledControlRow>
  );
}

function CloudflareAccessInputRows({ section, disabled, labelClassName }: CloudflareAccessCredentialFieldsProps) {
  const { clientId, clientSecret, validationError } = section;
  const secretDescriptionId = useId();
  const secretInputRef = useRef<HTMLInputElement>(null);
  const changeSecretButtonRef = useRef<HTMLButtonElement>(null);
  const requestedSecretFocus = useRef<"input" | "change" | null>(null);
  const requiresReplacement = validationError === "client_secret_required";
  const showSecretEditor =
    !section.hasSavedSecret || section.secretEditing || requiresReplacement || clientSecret.value.length > 0;

  useLayoutEffect(() => {
    const target = requestedSecretFocus.current;
    if (!target) return;
    requestedSecretFocus.current = null;
    if (section.secretEditing !== (target === "input")) return;

    const element =
      target === "input"
        ? secretInputRef.current
        : (changeSecretButtonRef.current ?? (requiresReplacement ? secretInputRef.current : null));
    element?.focus();
  }, [requiresReplacement, section.secretEditing]);

  const handleChangeSecret = () => {
    requestedSecretFocus.current = "input";
    section.onSecretEditingChange(true);
  };
  const handleCancelSecretChange = () => {
    requestedSecretFocus.current = "change";
    section.onSecretEditingChange(false);
  };

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
        inputClassName={changedInputClassName(clientId.changed)}
        labelAccessory={changedLabelAccessory(clientId.changed, section.changedFieldLabel)}
        disabled={disabled}
        errorText={validationError === "client_id_required" ? section.clientIdError : undefined}
      />
      {showSecretEditor ? (
        <CloudflareAccessSecretEditor
          section={section}
          disabled={disabled}
          labelClassName={labelClassName}
          requiresReplacement={requiresReplacement}
          descriptionId={secretDescriptionId}
          inputRef={secretInputRef}
          onCancel={handleCancelSecretChange}
        />
      ) : (
        <CloudflareAccessSavedSecret
          section={section}
          disabled={disabled}
          labelClassName={labelClassName}
          buttonRef={changeSecretButtonRef}
          onChange={handleChangeSecret}
        />
      )}
    </>
  );
}

export function CloudflareAccessCredentialFields({
  section,
  disabled,
  labelClassName,
}: CloudflareAccessCredentialFieldsProps) {
  const { t } = useTranslation("settings");
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
      {status === "authorization_required" && (
        <CloudflareAccessAuthorizationRequired section={section} disabled={disabled} labelClassName={labelClassName} />
      )}
      {status === "ready" && (
        <CloudflareAccessControl
          mode="detail"
          label={section.label}
          description={section.description}
          labelIndicator={section.changedIndicator}
          checked={section.enabled}
          onChange={section.onEnabledChange}
          disabled={disabled}
          labelClassName={labelClassName}
        />
      )}
      {status === "ready" && !section.enabled && section.hasSavedSecret && (
        <p className="text-sm leading-[1.5] text-foreground-soft">{t("account.cloudflare_access_remove_on_save")}</p>
      )}
      {showInputRows && (
        <CloudflareAccessInputRows section={section} disabled={disabled} labelClassName={labelClassName} />
      )}
      {status !== "error" && section.failureNotice && <CredentialFailureNoticeView notice={section.failureNotice} />}
    </>
  );
}
