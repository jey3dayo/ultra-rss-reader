import { cva } from "class-variance-authority";
import { Copy, Pencil, RefreshCw } from "lucide-react";
import type { LocalFeedSyncStatusDto } from "@/api/tauri-commands";
import { Button, SurfaceCard } from "@/design-system";
import type { FeedRetryOutcomeKind } from "@/hooks/use-local-feed-sync-statuses";
import { formatShortDateTime } from "@/lib/datetime";

export type FetchErrorLabels = {
  heading: string;
  lastAttempt: string;
  lastSuccess?: string;
  errorCount?: (count: number) => string;
  copyDiagnosticId: string;
  retry: string;
  retrying: string;
  editFeedUrl: string;
  urlChangeGuidance?: string;
  reason: (kind: NonNullable<LocalFeedSyncStatusDto["error_kind"]>) => string;
  retryOutcome: (kind: FeedRetryOutcomeKind) => string;
};

const retryOutcomeVariants = cva("text-sm leading-relaxed", {
  variants: {
    tone: {
      neutral: "text-foreground-soft",
      warning: "text-state-warning-foreground",
      danger: "text-state-danger-foreground",
    },
  },
});

const RETRY_OUTCOME_PRESENTATION = {
  succeeded: { tone: "neutral", role: "status" },
  busy: { tone: "neutral", role: "status" },
  incomplete: { tone: "warning", role: "alert" },
  failed: { tone: "danger", role: "alert" },
  "refresh-failed": { tone: "danger", role: "alert" },
} as const satisfies Record<FeedRetryOutcomeKind, { tone: "neutral" | "warning" | "danger"; role: "status" | "alert" }>;

type FetchErrorDetailCardProps = {
  errorKind: NonNullable<LocalFeedSyncStatusDto["error_kind"]>;
  labels: FetchErrorLabels;
  retryOutcome: FeedRetryOutcomeKind | null;
  formattedLastAttempt: string | null;
  formattedLastSuccess: string | null;
  errorCount: number;
  diagnosticId: string | null | undefined;
  feedId: string;
  onRetryFeed: (feedId: string) => void;
  onEditFeed: () => void;
  isRetryingFeed: (feedId: string) => boolean;
  onCopyDiagnosticId: (diagnosticId: string) => void;
};

function FetchErrorDetailCard({
  errorKind,
  labels,
  retryOutcome,
  formattedLastAttempt,
  formattedLastSuccess,
  errorCount,
  diagnosticId,
  feedId,
  onRetryFeed,
  onEditFeed,
  isRetryingFeed,
  onCopyDiagnosticId,
}: FetchErrorDetailCardProps) {
  const isRetrying = isRetryingFeed(feedId);

  return (
    <SurfaceCard
      data-testid="subscriptions-fetch-error-detail"
      variant="section"
      tone="default"
      padding="compact"
      className="flex flex-col gap-3 rounded-md border border-state-danger-border/70 bg-state-danger-surface/70 p-3.5 shadow-none sm:p-4"
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-state-danger-foreground">{labels.heading}</h3>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{labels.reason(errorKind)}</p>
        {errorKind === "private_address_blocked" && labels.urlChangeGuidance ? (
          <p
            data-testid="subscriptions-fetch-error-url-guidance"
            className="mt-1 text-sm leading-relaxed text-foreground-soft"
          >
            {labels.urlChangeGuidance}
          </p>
        ) : null}
        {formattedLastAttempt ? (
          <p className="mt-1 text-xs text-foreground-soft">
            {labels.lastAttempt}: {formattedLastAttempt}
          </p>
        ) : null}
        {formattedLastSuccess && labels.lastSuccess ? (
          <p className="mt-1 text-xs text-foreground-soft">
            {labels.lastSuccess}: {formattedLastSuccess}
          </p>
        ) : null}
        {errorCount >= 2 && labels.errorCount ? (
          <p className="mt-1 text-xs text-foreground-soft">{labels.errorCount(errorCount)}</p>
        ) : null}
        {retryOutcome ? (
          <p
            role={RETRY_OUTCOME_PRESENTATION[retryOutcome].role}
            data-testid="subscriptions-fetch-error-retry-outcome"
            className={retryOutcomeVariants({ tone: RETRY_OUTCOME_PRESENTATION[retryOutcome].tone, className: "mt-2" })}
          >
            {labels.retryOutcome(retryOutcome)}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {errorKind === "private_address_blocked" ? (
          <Button type="button" size="sm" variant="ghost" onClick={onEditFeed}>
            <Pencil className="size-4" />
            {labels.editFeedUrl}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={isRetrying}
          aria-busy={isRetrying}
          onClick={() => onRetryFeed(feedId)}
        >
          <RefreshCw className="size-4" />
          {isRetrying ? labels.retrying : labels.retry}
        </Button>
        {diagnosticId ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onCopyDiagnosticId(diagnosticId)}>
            <Copy className="size-4" />
            {labels.copyDiagnosticId}
          </Button>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

type RemoteFetchFailureDetailCardProps = {
  labels: { heading: string; body: string; lastSuccess: string };
  formattedLastSuccess: string | null;
};

function RemoteFetchFailureDetailCard({ labels, formattedLastSuccess }: RemoteFetchFailureDetailCardProps) {
  return (
    <SurfaceCard
      data-testid="subscriptions-remote-fetch-failure-detail"
      variant="section"
      tone="default"
      padding="compact"
      className="flex flex-col gap-3 rounded-md border border-state-danger-border/70 bg-state-danger-surface/70 p-3.5 shadow-none sm:p-4"
    >
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-state-danger-foreground">{labels.heading}</h3>
        {labels.body ? <p className="mt-1 text-sm leading-relaxed text-foreground">{labels.body}</p> : null}
        {formattedLastSuccess ? (
          <p className="mt-1 text-xs text-foreground-soft">
            {labels.lastSuccess}: {formattedLastSuccess}
          </p>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

type SubscriptionFetchStatusCardProps = {
  fetchError: LocalFeedSyncStatusDto | null | undefined;
  fetchErrorLabels: FetchErrorLabels;
  remoteFetchFailure: { lastSuccessAt: string } | null;
  remoteFetchFailureLabels: { heading: string; body: string; lastSuccess: string };
  retryOutcome: FeedRetryOutcomeKind | null | undefined;
  formattedLastAttempt: string | null;
  formattedLastSuccess: string | null;
  dateLocale: string;
  feedId: string;
  onRetryFeed: (feedId: string) => void;
  onEditFeed: () => void;
  isRetryingFeed: (feedId: string) => boolean;
  onCopyDiagnosticId: (diagnosticId: string) => void;
};

export function SubscriptionFetchStatusCard({
  fetchError,
  fetchErrorLabels,
  remoteFetchFailure,
  remoteFetchFailureLabels,
  retryOutcome,
  formattedLastAttempt,
  formattedLastSuccess,
  dateLocale,
  feedId,
  onRetryFeed,
  onEditFeed,
  isRetryingFeed,
  onCopyDiagnosticId,
}: SubscriptionFetchStatusCardProps) {
  if (fetchError?.error_kind) {
    return (
      <FetchErrorDetailCard
        errorKind={fetchError.error_kind}
        labels={fetchErrorLabels}
        retryOutcome={retryOutcome ?? null}
        formattedLastAttempt={formattedLastAttempt}
        formattedLastSuccess={formattedLastSuccess}
        errorCount={fetchError.error_count}
        diagnosticId={fetchError.diagnostic_id}
        feedId={feedId}
        onRetryFeed={onRetryFeed}
        onEditFeed={onEditFeed}
        isRetryingFeed={isRetryingFeed}
        onCopyDiagnosticId={onCopyDiagnosticId}
      />
    );
  }
  if (remoteFetchFailure) {
    return (
      <RemoteFetchFailureDetailCard
        labels={remoteFetchFailureLabels}
        formattedLastSuccess={formatShortDateTime(remoteFetchFailure.lastSuccessAt, dateLocale)}
      />
    );
  }
  return null;
}
