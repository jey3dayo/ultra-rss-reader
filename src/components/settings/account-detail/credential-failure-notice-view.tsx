import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SurfaceCard } from "@/design-system";

export type CredentialFailureNoticeViewModel = {
  lines: string[];
  retryLabel: string;
  onRetry: () => void;
  retryDisabled: boolean;
};

export function CredentialFailureNoticeBody({ notice }: { notice: CredentialFailureNoticeViewModel }) {
  return (
    <>
      {notice.lines.map((line) => (
        <p key={line} className="text-sm leading-[1.5]">
          {line}
        </p>
      ))}
      <div className="mt-3 flex flex-wrap gap-2">
        <SettingsActionButton type="button" size="compact" disabled={notice.retryDisabled} onClick={notice.onRetry}>
          {notice.retryLabel}
        </SettingsActionButton>
      </div>
    </>
  );
}

export function CredentialFailureNoticeView({ notice }: { notice: CredentialFailureNoticeViewModel }) {
  return (
    <SurfaceCard variant="info" tone="danger" padding="compact" role="alert">
      <CredentialFailureNoticeBody notice={notice} />
    </SurfaceCard>
  );
}
