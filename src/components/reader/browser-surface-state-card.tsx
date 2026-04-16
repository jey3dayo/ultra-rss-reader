import { CircleAlert, ExternalLink, RotateCcw } from "lucide-react";
import { SurfaceCard } from "@/components/shared/surface-card";
import { Button } from "@/components/ui/button";
import type { BrowserSurfaceStateCardProps } from "./browser-view.types";

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
      <p className="mt-2 text-pretty text-sm leading-6 text-muted-foreground">{issue.description}</p>
      {showTechnicalDetail && issue.detail ? (
        <div className="mt-3 space-y-1.5 text-left">
          <p className="text-[11px] font-medium tracking-[0.08em] text-foreground-soft uppercase">
            {labels.technicalDetail}
          </p>
          <p className="rounded-[var(--radius-surface-info)] border border-border/55 bg-surface-1/85 px-3 py-2 text-xs text-muted-foreground">
            {issue.detail}
          </p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {issue.canRetry ? (
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" />
            {labels.retryWebPreview}
          </Button>
        ) : null}
        <Button type="button" variant="secondary" size="sm" onClick={onOpenExternal}>
          <ExternalLink className="h-3.5 w-3.5" />
          {labels.openInExternalBrowser}
        </Button>
      </div>
    </SurfaceCard>
  );
}
