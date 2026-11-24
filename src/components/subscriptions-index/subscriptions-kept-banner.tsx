import { Button } from "@/design-system";

export type SubscriptionsKeptBanner = {
  message: string;
  toggle: { label: string; onClick: () => void } | null;
  resetLabel: string;
  onReset: () => void;
};

export function SubscriptionsKeptBannerView({ banner }: { banner: SubscriptionsKeptBanner | null | undefined }) {
  if (!banner) {
    return null;
  }

  return (
    <div
      data-testid="subscriptions-kept-banner"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 py-1 text-sm"
    >
      <p role="status" className="min-w-0 flex-1 text-foreground-soft">
        {banner.message}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {banner.toggle ? (
          <Button type="button" variant="ghost" size="sm" onClick={banner.toggle.onClick}>
            {banner.toggle.label}
          </Button>
        ) : null}
        <Button type="button" variant="ghost" size="sm" onClick={banner.onReset}>
          {banner.resetLabel}
        </Button>
      </div>
    </div>
  );
}
