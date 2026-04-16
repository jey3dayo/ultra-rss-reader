import { ChevronDown } from "lucide-react";
import { FeedFavicon } from "@/components/shared/feed-favicon";
import { LabelChip } from "@/components/shared/label-chip";
import { NavRowButton } from "@/components/shared/nav-row-button";
import { cn } from "@/lib/utils";
import type { SubscriptionListGroup, SubscriptionListRow } from "./subscriptions-index.types";

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
    <section
      className="flex min-h-0 flex-col border-r border-border/70 px-4 py-4 sm:px-6"
      style={{ backgroundColor: "var(--subscriptions-list-surface)" }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{heading}</h2>
        {hasRows ? (
          <LabelChip tone="muted">{groups.reduce((count, group) => count + group.rows.length, 0)}</LabelChip>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {!hasRows ? (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
            {emptyLabel}
          </p>
        ) : (
          groups.map((group) => (
            <div key={group.key} className="space-y-2">
              <div
                data-testid={`subscriptions-folder-row-${group.folderId ?? "ungrouped"}`}
                data-folder-drop-target={group.folderId ? "true" : "false"}
                className="rounded-md flex items-center justify-between border-b px-1 py-1.5"
                style={{ borderColor: "var(--subscriptions-list-divider)" }}
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
                      "items-center rounded-md border-border/65 px-3 py-2.5",
                      selectedFeedId !== row.feed.id && "border-border/60",
                    )}
                    leading={
                      <span
                        className={cn(
                          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-colors",
                          selectedFeedId === row.feed.id
                            ? "bg-surface-1 text-foreground shadow-elevation-1"
                            : "bg-surface-2/88 text-foreground",
                        )}
                        style={{
                          borderColor: "var(--subscriptions-list-divider)",
                          backgroundColor:
                            selectedFeedId === row.feed.id
                              ? "var(--subscriptions-list-favicon-surface)"
                              : "var(--subscriptions-list-favicon-surface-muted)",
                        }}
                      >
                        <FeedFavicon title={row.feed.title} url={row.feed.url} siteUrl={row.feed.site_url} />
                      </span>
                    }
                    title={
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-foreground">{row.feed.title}</span>
                        <span className="text-[11px] text-foreground-soft">{formatFolderLabel(row.folderName)}</span>
                      </div>
                    }
                    description={
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-foreground-soft">
                        <LabelChip tone="muted" size="compact">
                          {statusLabels[row.status.labelKey]}
                        </LabelChip>
                        <span aria-hidden="true" style={{ color: "var(--subscriptions-list-meta-divider)" }}>
                          •
                        </span>
                        <span>{formatUnreadCountLabel(row.feed.unread_count)}</span>
                        <span aria-hidden="true" style={{ color: "var(--subscriptions-list-meta-divider)" }}>
                          •
                        </span>
                        <span>{formatLatestArticleLabel(row.latestArticleAt)}</span>
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
