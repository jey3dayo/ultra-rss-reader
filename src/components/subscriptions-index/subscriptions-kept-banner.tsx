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
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border/60 bg-surface-1/58 px-3.5 py-2.5 text-sm"
    >
      <p role="status" className="min-w-0 flex-1 text-foreground-soft">
        {banner.message}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {banner.toggle ? (
          <Button type="button" variant="outline" onClick={banner.toggle.onClick} className="min-h-11">
            {banner.toggle.label}
          </Button>
        ) : null}
        <Button type="button" variant="outline" onClick={banner.onReset} className="min-h-11">
          {banner.resetLabel}
        </Button>
      </div>
    </div>
  );
}
