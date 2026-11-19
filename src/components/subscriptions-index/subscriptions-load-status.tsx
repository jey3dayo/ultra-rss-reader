import { Button, Skeleton, SurfaceCard } from "@/design-system";

export type SubscriptionsLoadFailure = {
  message: string;
  retryLabel: string;
  retrying: boolean;
  onRetry: () => void;
};

export type SubscriptionsListLoadState =
  | { status: "ready" }
  | { status: "loading"; label: string }
  | { status: "error"; failure: SubscriptionsLoadFailure; hasData: boolean };

const SKELETON_ROWS = [
  { id: "first", titleWidthClassName: "w-2/5", metaWidthClassName: "w-48" },
  { id: "second", titleWidthClassName: "w-1/2", metaWidthClassName: "w-40" },
  { id: "third", titleWidthClassName: "w-1/3", metaWidthClassName: "w-52" },
  { id: "fourth", titleWidthClassName: "w-3/5", metaWidthClassName: "w-44" },
  { id: "fifth", titleWidthClassName: "w-2/5", metaWidthClassName: "w-40" },
] as const;

export function resolveListPaneDisplay(loadState: SubscriptionsListLoadState, hasRows: boolean) {
  const loading = loadState.status === "loading";
  const listUnavailable = loadState.status === "error" && !loadState.hasData;
  const showEmptyState = !hasRows && !loading && !listUnavailable;
  return { loading, listUnavailable, showRows: hasRows && !loading, showEmptyState };
}

export function SubscriptionsLoadFailureBanner({
  failure,
  testId,
}: {
  failure: SubscriptionsLoadFailure;
  testId?: string;
}) {
  return (
    <SurfaceCard
      variant="info"
      tone="danger"
      padding="compact"
      role="alert"
      data-testid={testId}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="min-w-0 flex-1 text-sm leading-[1.5]">{failure.message}</p>
      <Button
        type="button"
        variant="outline"
        disabled={failure.retrying}
        aria-busy={failure.retrying}
        onClick={failure.onRetry}
        className="min-h-11 shrink-0"
      >
        {failure.retryLabel}
      </Button>
    </SurfaceCard>
  );
}

function SubscriptionsListSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" data-testid="subscriptions-list-skeleton">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-1.5">
        {SKELETON_ROWS.map((row) => (
          <div
            key={row.id}
            className="flex items-center gap-3 rounded-md border border-transparent bg-surface-1/36 px-3.5 py-3.5"
          >
            <Skeleton className="size-9 shrink-0 bg-surface-4/70" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className={`h-3.5 bg-surface-4/70 ${row.titleWidthClassName}`} />
              <Skeleton className={`h-3 max-w-full bg-surface-4/55 ${row.metaWidthClassName}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SubscriptionsListLoadStatus({ loadState }: { loadState: SubscriptionsListLoadState }) {
  if (loadState.status === "error") {
    return <SubscriptionsLoadFailureBanner failure={loadState.failure} testId="subscriptions-list-load-error" />;
  }
  return loadState.status === "loading" ? <SubscriptionsListSkeleton label={loadState.label} /> : null;
}
