import { SectionHeading } from "@/components/shared/section-heading";
import { CopyableTextField } from "@/components/shared/copyable-text-field";
import { LabeledControlRow } from "@/components/shared/labeled-control-row";
import { LoadingButton } from "@/components/shared/loading-button";
import { Input } from "@/components/ui/input";

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
        <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-border py-3">
          <div className="min-w-0 flex-1">
            <CopyableTextField
              label={serverUrlLabel}
              name="server-url"
              type="url"
              value={serverUrlValue ?? ""}
              placeholder={serverUrlPlaceholder}
              className="h-auto border-border bg-background px-2 py-1 text-sm"
              copyLabel={serverUrlCopyLabel}
              onCopy={onServerUrlCopy}
              onChange={onServerUrlChange}
              onBlur={onServerUrlBlur}
            />
          </div>
        </div>
      )}
      <LabeledControlRow label={usernameLabel}>
        <Input
          value={usernameValue}
          onChange={(e) => onUsernameChange(e.target.value)}
          onBlur={onUsernameBlur}
          className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
        />
      </LabeledControlRow>
      <LabeledControlRow label={passwordLabel}>
        <Input
          type="password"
          value={passwordValue}
          onChange={(e) => onPasswordChange(e.target.value)}
          onFocus={onPasswordFocus}
          onBlur={onPasswordBlur}
          placeholder={passwordPlaceholder}
          className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
        />
      </LabeledControlRow>
      {onTestConnection && (
        <div className="pt-3">
          <LoadingButton
            size="sm"
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
