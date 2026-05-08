import { Copy } from "lucide-react";
import type { ComponentProps } from "react";
import { SettingsLoadingActionButton } from "@/components/settings/settings-loading-action-button";
import { SettingsSection } from "@/components/settings/shared/settings-section";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import type { AccountCredentialInputRow } from "./types";

const EMPTY_EXTRA_ROWS: AccountCredentialInputRow[] = [];
const CONTROL_RAIL_CLASS = "w-full sm:max-w-[30rem]";

export type AccountCredentialsSectionViewProps = {
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
}: AccountCredentialsSectionViewProps) {
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
          inputClassName="h-11"
          actionLabel={serverUrlCopyLabel}
          actionAriaLabel={serverUrlCopyLabel}
          actionTooltipLabel={serverUrlCopyLabel}
          actionIcon={<Copy className="h-3.5 w-3.5" />}
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
          inputClassName="h-11"
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
        inputClassName="h-11"
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
        inputClassName="h-11"
        disabled={disabled}
      />
      {onTestConnection && (
        <LabeledControlRow label={testConnectionLabel ?? ""} labelClassName={labelColumnClassName}>
          <div className={`${CONTROL_RAIL_CLASS} flex justify-end`}>
            <SettingsLoadingActionButton
              tone={testConnectionTone}
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
