import { SettingsActionButton } from "@/components/settings/shared/settings-action-button";
import { SurfaceCard } from "@/design-system";

type PreferenceSaveFailureBannerProps = {
  message: string;
  retryLabel: string;
  onRetry: () => void;
};

export function PreferenceSaveFailureBanner({ message, retryLabel, onRetry }: PreferenceSaveFailureBannerProps) {
  return (
    <SurfaceCard
      variant="info"
      tone="danger"
      padding="compact"
      role="alert"
      className="mx-5 mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 sm:mx-8"
    >
      <p className="min-w-0 flex-1 text-sm leading-[1.5]">{message}</p>
      <SettingsActionButton type="button" size="standalone" tone="content" onClick={onRetry}>
        {retryLabel}
      </SettingsActionButton>
    </SurfaceCard>
  );
}
