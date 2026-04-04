import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { FeedCleanupCandidate, FeedCleanupReasonKey } from "@/lib/feed-cleanup";
import { cn } from "@/lib/utils";

type FilterOption = {
  key: "stale_90d" | "no_unread" | "no_stars";
  label: string;
};

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function FeedCleanupPageView({
  open,
  title,
  subtitle,
  filtersLabel,
  queueLabel,
  reviewLabel,
  filterOptions,
  activeFilterKeys,
  queue,
  selectedCandidate,
  showDeferred,
  showDeferredLabel,
  emptyLabel,
  keepLabel,
  laterLabel,
  deleteLabel,
  folderLabel,
  latestArticleLabel,
  unreadCountLabel,
  starredCountLabel,
  reasonsLabel,
  noSelectionLabel,
  deferredBadgeLabel,
  reasonLabels,
  onOpenChange,
  onToggleFilter,
  onToggleShowDeferred,
  onSelectCandidate,
  onKeep,
  onLater,
  onDelete,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  filtersLabel: string;
  queueLabel: string;
  reviewLabel: string;
  filterOptions: FilterOption[];
  activeFilterKeys: Set<FilterOption["key"]>;
  queue: Array<FeedCleanupCandidate & { deferred?: boolean }>;
  selectedCandidate: (FeedCleanupCandidate & { deferred?: boolean }) | null;
  showDeferred: boolean;
  showDeferredLabel: string;
  emptyLabel: string;
  keepLabel: string;
  laterLabel: string;
  deleteLabel: string;
  folderLabel: string;
  latestArticleLabel: string;
  unreadCountLabel: string;
  starredCountLabel: string;
  reasonsLabel: string;
  noSelectionLabel: string;
  deferredBadgeLabel: string;
  reasonLabels: Record<FeedCleanupReasonKey, string>;
  onOpenChange: (open: boolean) => void;
  onToggleFilter: (key: FilterOption["key"]) => void;
  onToggleShowDeferred: () => void;
  onSelectCandidate: (candidateId: string) => void;
  onKeep: () => void;
  onLater: () => void;
  onDelete: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[84vh] max-h-[760px] max-w-[1120px] overflow-hidden p-0 sm:max-w-[1120px]">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle>{title}</DialogTitle>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 overflow-hidden gap-0 lg:grid-cols-[220px_minmax(0,1fr)_320px]">
            <section className="min-h-0 overflow-hidden border-r border-border bg-sidebar/60 px-4 py-4">
              <h3 className="mb-3 text-sm font-semibold">{filtersLabel}</h3>
              <div className="space-y-2">
                {filterOptions.map((filter) => (
                  <Button
                    key={filter.key}
                    variant={activeFilterKeys.has(filter.key) ? "secondary" : "ghost"}
                    className="w-full justify-start"
                    onClick={() => onToggleFilter(filter.key)}
                  >
                    {filter.label}
                  </Button>
                ))}
                <Button
                  variant={showDeferred ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={onToggleShowDeferred}
                >
                  {showDeferredLabel}
                </Button>
              </div>
            </section>

            <section className="min-h-0 overflow-hidden border-r border-border px-4 py-4">
              <h3 className="mb-3 text-sm font-semibold">{queueLabel}</h3>
              <div className="h-[calc(100%-2rem)] space-y-2 overflow-y-auto pr-1">
                {queue.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                    {emptyLabel}
                  </p>
                ) : (
                  queue.map((candidate) => (
                    <button
                      key={candidate.feedId}
                      type="button"
                      aria-label={candidate.title}
                      onClick={() => onSelectCandidate(candidate.feedId)}
                      className={cn(
                        "flex w-full flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors",
                        selectedCandidate?.feedId === candidate.feedId
                          ? "border-primary/60 bg-primary/10"
                          : "border-border bg-card hover:bg-muted/60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-foreground">{candidate.title}</span>
                        {candidate.deferred ? (
                          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                            {deferredBadgeLabel}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {candidate.folderName ?? "—"} · {candidate.staleDays ?? 0}d
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="flex min-h-0 flex-col overflow-hidden px-5 py-4">
              <h3 className="mb-3 text-sm font-semibold">{reviewLabel}</h3>
              {selectedCandidate ? (
                <div className="flex min-h-0 flex-1 flex-col gap-4">
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                    <div className="rounded-xl border border-border bg-card px-4 py-4">
                      <h4 className="text-base font-semibold">{selectedCandidate.title}</h4>
                      <dl className="mt-4 grid gap-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-muted-foreground">{folderLabel}</dt>
                          <dd>{selectedCandidate.folderName ?? "—"}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-muted-foreground">{latestArticleLabel}</dt>
                          <dd>{formatDate(selectedCandidate.latestArticleAt)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-muted-foreground">{unreadCountLabel}</dt>
                          <dd>{selectedCandidate.unreadCount}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-muted-foreground">{starredCountLabel}</dt>
                          <dd>{selectedCandidate.starredCount}</dd>
                        </div>
                      </dl>
                    </div>

                    <div className="rounded-xl border border-border bg-card px-4 py-4">
                      <h4 className="mb-2 text-sm font-semibold">{reasonsLabel}</h4>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {selectedCandidate.reasonKeys.map((reason) => (
                          <li key={reason}>{reasonLabels[reason]}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="border-t border-border/70 pt-3">
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={onKeep}>
                        {keepLabel}
                      </Button>
                      <Button variant="secondary" onClick={onLater}>
                        {laterLabel}
                      </Button>
                      <Button variant="destructive" onClick={onDelete}>
                        {deleteLabel}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                  {noSelectionLabel}
                </p>
              )}
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
