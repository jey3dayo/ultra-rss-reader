import { SectionHeading } from "@/components/settings/settings-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AccountCredentialsSectionViewProps = {
  heading: string;
  serverUrlLabel?: string;
  serverUrlValue?: string;
  serverUrlPlaceholder?: string;
  onServerUrlChange?: (value: string) => void;
  onServerUrlBlur?: () => void;
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
          <span className="text-sm text-foreground">{serverUrlLabel}</span>
          <Input
            value={serverUrlValue ?? ""}
            onChange={(e) => onServerUrlChange(e.target.value)}
            onBlur={onServerUrlBlur}
            placeholder={serverUrlPlaceholder}
            className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
          />
        </div>
      )}
      <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-border py-3">
        <span className="text-sm text-foreground">{usernameLabel}</span>
        <Input
          value={usernameValue}
          onChange={(e) => onUsernameChange(e.target.value)}
          onBlur={onUsernameBlur}
          className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
        />
      </div>
      <div className="flex min-h-[44px] items-center justify-between gap-3 border-b border-border py-3">
        <span className="text-sm text-foreground">{passwordLabel}</span>
        <Input
          type="password"
          value={passwordValue}
          onChange={(e) => onPasswordChange(e.target.value)}
          onFocus={onPasswordFocus}
          onBlur={onPasswordBlur}
          placeholder={passwordPlaceholder}
          className="h-auto w-auto border-border bg-background px-2 py-1 text-sm"
        />
      </div>
      {onTestConnection && (
        <div className="pt-3">
          <Button size="sm" onClick={onTestConnection} disabled={isTestingConnection}>
            {isTestingConnection ? testingConnectionLabel : testConnectionLabel}
          </Button>
        </div>
      )}
    </section>
  );
}
