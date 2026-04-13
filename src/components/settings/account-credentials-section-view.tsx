import { CopyableTextField } from "@/components/shared/copyable-text-field";
import { LabeledInputRow } from "@/components/shared/labeled-input-row";
import { LoadingButton } from "@/components/shared/loading-button";
import { SectionHeading } from "@/components/shared/section-heading";

export type AccountCredentialsSectionViewProps = {
  heading: string;
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
};

export function AccountCredentialsSectionView({
  heading,
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
}: AccountCredentialsSectionViewProps) {
  return (
    <section className="mb-6">
      <SectionHeading>{heading}</SectionHeading>
      {serverUrlLabel && onServerUrlChange && (
        <div className="flex min-h-[44px] flex-col items-stretch gap-3 border-b border-border py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <CopyableTextField
              label={serverUrlLabel}
              name="server-url"
              type="url"
              value={serverUrlValue ?? ""}
              placeholder={serverUrlPlaceholder}
              className="h-auto w-full border-border bg-background px-2 py-1 text-sm"
              copyLabel={serverUrlCopyLabel}
              onCopy={onServerUrlCopy}
              onChange={onServerUrlChange}
              onBlur={onServerUrlBlur}
            />
          </div>
        </div>
      )}
      <LabeledInputRow
        label={usernameLabel}
        value={usernameValue}
        onChange={onUsernameChange}
        onBlur={onUsernameBlur}
        rowClassName="flex-col items-stretch sm:flex-row sm:items-center"
        inputClassName="h-auto w-full border-border bg-background px-2 py-1 text-sm sm:w-auto"
      />
      <LabeledInputRow
        label={passwordLabel}
        type="password"
        value={passwordValue}
        onChange={onPasswordChange}
        onFocus={onPasswordFocus}
        onBlur={onPasswordBlur}
        placeholder={passwordPlaceholder}
        rowClassName="flex-col items-stretch sm:flex-row sm:items-center"
        inputClassName="h-auto w-full border-border bg-background px-2 py-1 text-sm sm:w-auto"
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
    </section>
  );
}
