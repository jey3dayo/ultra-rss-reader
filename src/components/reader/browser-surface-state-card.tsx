import { CircleAlert, ExternalLink, RotateCcw } from "lucide-react";
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
    <div
      data-testid="browser-surface-state"
      className="w-full max-w-[min(42rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-black/62 px-5 py-4 text-center shadow-[0_18px_40px_rgba(0,0,0,0.32)] backdrop-blur-md"
    >
      <div className="flex items-center justify-center gap-2 text-white">
        <CircleAlert aria-hidden="true" className="size-4 text-orange-300" />
        <p className="text-balance text-sm font-semibold leading-tight">{issue.title}</p>
      </div>
      <p className="mt-2 text-pretty text-sm leading-6 text-white/72">{issue.description}</p>
      {showTechnicalDetail && issue.detail ? (
        <div className="mt-3 space-y-1.5 text-left">
          <p className="text-[11px] font-medium tracking-[0.08em] text-white/45 uppercase">{labels.technicalDetail}</p>
          <p className="rounded-lg border border-white/8 bg-white/5 px-3 py-2 text-xs text-white/68">{issue.detail}</p>
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
    </div>
  );
}
