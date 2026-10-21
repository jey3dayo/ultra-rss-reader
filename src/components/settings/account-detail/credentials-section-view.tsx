import { cn } from "cn";
import { Copy } from "lucide-react";
import type { ReactNode } from "react";
import { ChangedFieldIndicator } from "@/components/settings/shared/changed-field-indicator";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import {
  SETTINGS_CHANGED_CONTROL_CLASS,
  SETTINGS_CONTROL_SURFACE_CLASS,
} from "@/components/settings/shared/settings-surface";
import { LabeledInputRow } from "@/design-system";
import type { AccountCloudflareAccessSection, AccountCredentialInputRow } from "./cloudflare-access-credential-fields";
import { CloudflareAccessCredentialFields } from "./cloudflare-access-credential-fields";
import { CredentialFailureNoticeView, type CredentialFailureNoticeViewModel } from "./credential-failure-notice-view";

const EMPTY_EXTRA_ROWS: AccountCredentialInputRow[] = [];

function inputClassFor(changed: boolean): string {
  return cn("h-11", SETTINGS_CONTROL_SURFACE_CLASS, changed && SETTINGS_CHANGED_CONTROL_CLASS);
}

type ChangedFieldState = {
  serverUrl: boolean;
  username: boolean;
  password: boolean;
};

function indicatorFor(changed: boolean, changedFieldLabel: string | undefined): ReactNode {
  return changed && changedFieldLabel ? <ChangedFieldIndicator label={changedFieldLabel} /> : undefined;
}

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
  onUsernameBlur?: () => void;
  passwordLabel: string;
  passwordValue: string;
  passwordPlaceholder: string;
  passwordFailureNotice?: CredentialFailureNoticeViewModel;
  onPasswordChange: (value: string) => void;
  onPasswordFocus?: () => void;
  onPasswordBlur?: () => void;
  extraRows?: AccountCredentialInputRow[];
  changedFields?: ChangedFieldState;
  changedFieldLabel?: string;
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
  passwordFailureNotice,
  onPasswordChange,
  onPasswordFocus,
  onPasswordBlur,
  extraRows,
  changedFields,
  changedFieldLabel,
  cloudflareAccess,
}: AccountCredentialsSectionViewProps) {
  const labelColumnClassName = "sm:w-40 sm:shrink-0";
  const resolvedExtraRows = extraRows ?? EMPTY_EXTRA_ROWS;
  const changed = changedFields ?? { serverUrl: false, username: false, password: false };

  const inputClass = (field: keyof ChangedFieldState) => inputClassFor(changed[field]);
  const accessory = (field: keyof ChangedFieldState) => indicatorFor(changed[field], changedFieldLabel);

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
          inputClassName={inputClass("serverUrl")}
          labelAccessory={accessory("serverUrl")}
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
        inputClassName={inputClass("username")}
        labelAccessory={accessory("username")}
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
        inputClassName={inputClass("password")}
        labelAccessory={accessory("password")}
        disabled={disabled}
      />
      {passwordFailureNotice && <CredentialFailureNoticeView notice={passwordFailureNotice} />}
      {cloudflareAccess && (
        <CloudflareAccessCredentialFields
          section={cloudflareAccess}
          disabled={disabled}
          labelClassName={labelColumnClassName}
        />
      )}
    </SettingsSection>
  );
}
