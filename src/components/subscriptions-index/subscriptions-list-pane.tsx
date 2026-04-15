import { ChevronDown } from "lucide-react";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { cn } from "@/lib/utils";
import type { SubscriptionListGroup, SubscriptionListRow } from "./subscriptions-index.types";

function buildFeedAvatar(title: string) {
  const trimmed = title.trim();
  const match = trimmed.match(/[A-Za-z0-9\u3040-\u30ff\u4e00-\u9faf]/u);
  return match?.[0]?.toUpperCase() ?? "?";
}

export function SubscriptionsListPane({
  heading,
  groups,
  selectedFeedId,
  emptyLabel,
  statusLabels,
  formatFolderLabel,
  formatUnreadCountLabel,
  formatLatestArticleLabel,
  onSelectFeed,
}: {
  heading: string;
  groups: SubscriptionListGroup[];
  selectedFeedId: string | null;
  emptyLabel: string;
  statusLabels: Record<SubscriptionListRow["status"]["labelKey"], string>;
  formatFolderLabel: (folderName: string | null) => string;
  formatUnreadCountLabel: (count: number) => string;
  formatLatestArticleLabel: (value: string | null) => string;
  onSelectFeed: (feedId: string) => void;
}) {
  const hasRows = groups.some((group) => group.rows.length > 0);
  return (
    <section className="flex min-h-0 flex-col border-r border-border/70 bg-background/55 px-4 py-4 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{heading}</h2>
        {hasRows ? (
          <span className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-[11px] text-muted-foreground">
            {groups.reduce((count, group) => count + group.rows.length, 0)}
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {!hasRows ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="space-y-2">
              <div
                data-testid={`subscriptions-folder-row-${group.folderId ?? "ungrouped"}`}
                data-folder-drop-target={group.folderId ? "true" : "false"}
                className="flex items-center justify-between border-b border-border/40 px-1 py-1.5"
              >
                <div className="flex items-center gap-1.5">
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  <h3 className="text-sm font-medium text-foreground">{group.label}</h3>
                </div>
                <span className="text-[11px] text-muted-foreground">{group.rows.length}</span>
              </div>
              <div className="space-y-1 pl-4">
                {group.rows.map((row) => (
                  <NavRowButton
                    key={row.feed.id}
                    selected={selectedFeedId === row.feed.id}
                    aria-pressed={selectedFeedId === row.feed.id}
                    onClick={() => onSelectFeed(row.feed.id)}
                    className={cn(
                      "items-center rounded-xl px-3 py-2.5",
                      selectedFeedId !== row.feed.id && "border-border/60",
                    )}
                    leading={
                      <span
                        className={cn(
                          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                          selectedFeedId === row.feed.id
                            ? "bg-card text-foreground"
                            : "bg-background/90 text-foreground",
                        )}
                      >
                        {buildFeedAvatar(row.feed.title)}
                      </span>
                    }
                    title={<span className="text-sm">{row.feed.title}</span>}
                    description={
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="rounded-full border border-border/60 bg-background/60 px-2.5 py-1">
                          {statusLabels[row.status.labelKey]}
                        </span>
                        <span className="rounded-full border border-border/50 bg-background/60 px-2.5 py-1">
                          {formatFolderLabel(row.folderName)}
                        </span>
                        <span className="rounded-full border border-border/50 bg-background/60 px-2.5 py-1">
                          {formatUnreadCountLabel(row.feed.unread_count)}
                        </span>
                        <span className="rounded-full border border-border/50 bg-background/60 px-2.5 py-1">
                          {formatLatestArticleLabel(row.latestArticleAt)}
                        </span>
                      </div>
                    }
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
