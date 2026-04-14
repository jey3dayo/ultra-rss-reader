import { cn } from "@/lib/utils";
import type { SubscriptionListRow } from "./subscriptions-index.types";

function resolveStatusClassName(tone: SubscriptionListRow["status"]["tone"]) {
  if (tone === "medium") {
    return "border-amber-300/40 bg-amber-500/10 text-amber-800 dark:text-amber-100";
  }

  return "border-border bg-background text-muted-foreground";
}

export function SubscriptionsListPane({
  heading,
  rows,
  selectedFeedId,
  emptyLabel,
  statusLabels,
  formatFolderLabel,
  formatUnreadCountLabel,
  formatLatestArticleLabel,
  onSelectFeed,
}: {
  heading: string;
  rows: SubscriptionListRow[];
  selectedFeedId: string | null;
  emptyLabel: string;
  statusLabels: Record<SubscriptionListRow["status"]["labelKey"], string>;
  formatFolderLabel: (folderName: string | null) => string;
  formatUnreadCountLabel: (count: number) => string;
  formatLatestArticleLabel: (value: string | null) => string;
  onSelectFeed: (feedId: string) => void;
}) {
  return (
    <section className="min-h-0 border-r border-border/70 px-4 py-4 sm:px-6">
      <h2 className="mb-3 text-sm font-semibold">{heading}</h2>
      <div className="space-y-3 overflow-y-auto pr-1">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          rows.map((row) => (
            <button
              key={row.feed.id}
              type="button"
              aria-label={row.feed.title}
              onClick={() => onSelectFeed(row.feed.id)}
              className={cn(
                "flex w-full flex-col gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                selectedFeedId === row.feed.id ? "border-primary/40 bg-primary/5" : "border-border/70 bg-card/60",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="line-clamp-1 font-medium text-foreground">{row.feed.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                    <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                      {formatFolderLabel(row.folderName)}
                    </span>
                    <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                      {formatUnreadCountLabel(row.feed.unread_count)}
                    </span>
                    <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1">
                      {formatLatestArticleLabel(row.latestArticleAt)}
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                    resolveStatusClassName(row.status.tone),
                  )}
                >
                  {statusLabels[row.status.labelKey]}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
