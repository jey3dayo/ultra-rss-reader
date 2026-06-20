import { CircleAlert, ExternalLink, RotateCcw } from "lucide-react";
import { SurfaceCard } from "@/design-system";
import type { BrowserSurfaceIssue } from "@/lib/browser/browser-surface-issue";
import { ReaderPassiveActionButton } from "./reader-passive-action-button";

type BrowserSurfaceStateCardProps = {
  issue: BrowserSurfaceIssue;
  showTechnicalDetail: boolean;
  onRetry: () => void;
  onOpenExternal: () => void;
  labels: {
    technicalDetail: string;
    retryWebPreview: string;
    openInExternalBrowser: string;
  };
};

export function BrowserSurfaceStateCard({
  issue,
  showTechnicalDetail,
  onRetry,
  onOpenExternal,
  labels,
}: BrowserSurfaceStateCardProps) {
  return (
    <SurfaceCard
      variant="info"
      tone="subtle"
      data-testid="browser-surface-state"
      className="w-full max-w-[min(42rem,calc(100vw-2rem))] text-center"
    >
      <div className="flex items-center justify-center gap-2 text-foreground">
        <CircleAlert aria-hidden="true" className="size-4 text-primary" />
        <p className="text-balance text-sm font-semibold leading-tight">{issue.title}</p>
      </div>
      <p className="mt-2 text-pretty text-sm leading-6 text-foreground-soft">{issue.description}</p>
      {showTechnicalDetail && issue.detail ? (
        <div className="mt-3 min-w-0 space-y-1.5 text-left">
          <p className="text-[11px] font-medium tracking-[0.08em] text-foreground-soft uppercase">
            {labels.technicalDetail}
          </p>
          <p className="min-w-0 rounded-md border border-browser-overlay-state-detail-border bg-browser-overlay-state-detail-surface px-3 py-2 text-xs break-words text-foreground-soft [overflow-wrap:anywhere]">
            {issue.detail}
          </p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {issue.canRetry ? (
          <ReaderPassiveActionButton variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="size-3.5" />
            {labels.retryWebPreview}
          </ReaderPassiveActionButton>
        ) : null}
        <ReaderPassiveActionButton variant="secondary" size="sm" onClick={onOpenExternal}>
          <ExternalLink className="size-3.5" />
          {labels.openInExternalBrowser}
        </ReaderPassiveActionButton>
      </div>
    </SurfaceCard>
  );
}
