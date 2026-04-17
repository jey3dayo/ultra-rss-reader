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
          rowClassName="flex-col items-stretch sm:flex-row sm:items-center sm:justify-start"
          labelClassName="sm:w-24 sm:shrink-0"
          controlClassName="sm:min-w-0 sm:flex-1"
          inputClassName="h-auto w-full border-border bg-background px-2 py-1 text-sm sm:flex-1"
          actionLabel={serverUrlCopyLabel}
          actionAriaLabel={serverUrlCopyLabel}
          actionTooltipLabel={serverUrlCopyLabel}
          actionIcon={<Copy className="h-3.5 w-3.5" />}
          actionPlacement="inside"
          actionVariant="ghost"
          actionSize="icon-sm"
          actionClassName="right-0"
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
          rowClassName="flex-col items-stretch sm:flex-row sm:items-center sm:justify-start"
          labelClassName="sm:w-24 sm:shrink-0"
          controlClassName="sm:min-w-0 sm:flex-1"
          inputClassName="h-auto w-full border-border bg-background px-2 py-1 text-sm sm:flex-1"
        />
      ))}
      <LabeledInputRow
        label={usernameLabel}
        value={usernameValue}
        onChange={onUsernameChange}
        onBlur={onUsernameBlur}
        rowClassName="flex-col items-stretch sm:flex-row sm:items-center sm:justify-start"
        labelClassName="sm:w-24 sm:shrink-0"
        controlClassName="sm:min-w-0 sm:flex-1"
        inputClassName="h-auto w-full border-border bg-background px-2 py-1 text-sm sm:flex-1"
      />
      <LabeledInputRow
        label={passwordLabel}
        type="password"
        value={passwordValue}
        onChange={onPasswordChange}
        onFocus={onPasswordFocus}
        onBlur={onPasswordBlur}
        placeholder={passwordPlaceholder}
        rowClassName="flex-col items-stretch sm:flex-row sm:items-center sm:justify-start"
        labelClassName="sm:w-24 sm:shrink-0"
        controlClassName="sm:min-w-0 sm:flex-1"
        inputClassName="h-auto w-full border-border bg-background px-2 py-1 text-sm sm:flex-1"
      />
      {onTestConnection && (
        <div className="pt-3">
          <LoadingButton
            size="sm"
            className="w-full justify-center sm:w-auto"
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
