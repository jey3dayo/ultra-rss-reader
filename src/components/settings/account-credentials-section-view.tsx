import { Copy } from "lucide-react";
import { SettingsSection } from "@/components/settings/settings-section";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { LoadingButton } from "@/components/shared/loading-button";
import type { AccountCredentialInputRow } from "./account-detail.types";

export type AccountCredentialsSectionViewProps = {
  heading: string;
  note?: string;
  serverUrlLabel?: string;
  serverUrlValue?: string;
  serverUrlPlaceholder?: string;
  onServerUrlChange?: (value: string) => void;
  onServerUrlBlur?: () => void;
  serverUrlCopyLabel?: string;
  onServerUrlCopy?: () => void;
  usernameLabel: string;
  usernameValue: string;
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
  extraRows?: AccountCredentialInputRow[];
};

export function AccountCredentialsSectionView({
  heading,
  note,
  serverUrlLabel,
  serverUrlValue,
  serverUrlPlaceholder,
  onServerUrlChange,
  onServerUrlBlur,
  serverUrlCopyLabel,
  onServerUrlCopy,
  usernameLabel,
  usernameValue,
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
  extraRows = [],
}: AccountCredentialsSectionViewProps) {
  const labelColumnClassName = "sm:w-40 sm:shrink-0";

  return (
    <SettingsSection heading={heading} note={note} surface="flat" className="mb-6 sm:mb-7">
      {serverUrlLabel && onServerUrlChange && (
        <LabeledInputRow
          label={serverUrlLabel}
          name="server-url"
          type="url"
          value={serverUrlValue ?? ""}
          placeholder={serverUrlPlaceholder}
          onChange={onServerUrlChange}
          onBlur={onServerUrlBlur}
          labelClassName={labelColumnClassName}
          inputClassName="h-10"
          actionLabel={serverUrlCopyLabel}
          actionAriaLabel={serverUrlCopyLabel}
          actionTooltipLabel={serverUrlCopyLabel}
          actionIcon={<Copy className="h-3.5 w-3.5" />}
          actionPlacement="inside"
          actionVariant="ghost"
          actionSize="icon-sm"
          onAction={onServerUrlCopy}
          actionDisabled={!serverUrlValue}
        />
      )}
      {extraRows.map((row) => (
        <LabeledInputRow
          key={row.label}
          label={row.label}
          type={row.type}
          value={row.value}
          onChange={row.onChange}
          onFocus={row.onFocus}
          onBlur={row.onBlur}
          placeholder={row.placeholder}
          labelClassName={labelColumnClassName}
          inputClassName="h-10"
        />
      ))}
      <LabeledInputRow
        label={usernameLabel}
        value={usernameValue}
        onChange={onUsernameChange}
        onBlur={onUsernameBlur}
        labelClassName={labelColumnClassName}
        inputClassName="h-10"
      />
      <LabeledInputRow
        label={passwordLabel}
        type="password"
        value={passwordValue}
        onChange={onPasswordChange}
        onFocus={onPasswordFocus}
        onBlur={onPasswordBlur}
        placeholder={passwordPlaceholder}
        labelClassName={labelColumnClassName}
        inputClassName="h-10"
      />
      {onTestConnection && (
        <div className="flex justify-end pt-3">
          <LoadingButton
            className="h-10 w-full justify-center px-4 sm:w-auto"
            onClick={onTestConnection}
            loading={isTestingConnection}
            loadingLabel={testingConnectionLabel}
          >
            {testConnectionLabel}
          </LoadingButton>
        </div>
      )}
    </SettingsSection>
  );
}
